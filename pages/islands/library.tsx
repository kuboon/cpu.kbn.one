import { on } from "@remix-run/ui";
import type { Handle, RemixNode } from "@remix-run/ui";
import { island } from "@kuboon/remix-ssg/client";

import type { ComponentDef } from "../lib/game/model.ts";
import { STAGES } from "../lib/game/stages/index.ts";
import { loadSave, storeSave } from "../lib/game/browser-storage.ts";
import {
  emptySave,
  parse,
  removeComponent,
  renameComponent,
  serialize,
  usedBy,
} from "../lib/game/storage.ts";
import type { SaveData } from "../lib/game/storage.ts";

/**
 * The registered components, grouped by stage, with rename, delete, export and import.
 *
 * Everything lives in the browser's storage, so the server render is a placeholder.
 */
export const Library = island(
  "library",
  "Library",
  function Library(handle: Handle<{ base: string }>) {
    let save: SaveData | undefined;
    let message: string | undefined;

    if (typeof document !== "undefined") {
      setTimeout(() => {
        save = loadSave() ?? emptySave();
        handle.update();
      }, 0);
    }

    function update(next: SaveData, note?: string): void {
      save = next;
      storeSave(next);
      message = note;
      handle.update();
    }

    function exportSave(): void {
      if (save === undefined) return;
      const blob = new Blob([serialize(save)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cpu-kbn-one-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importSave(file: File | undefined): Promise<void> {
      if (file === undefined) return;
      try {
        const next = parse(await file.text());
        if (
          !confirm(
            `「${file.name}」を読み込み、今の保存データを置き換えますか？`,
          )
        ) return;
        update(next, `${next.components.length} 個の部品を読み込みました。`);
      } catch (e) {
        message = `読み込めませんでした: ${(e as Error).message}`;
        handle.update();
      }
    }

    function row(component: ComponentDef): RemixNode {
      const users = save === undefined ? [] : usedBy(save, component.id);
      return (
        <tr key={component.id}>
          <td>
            <input
              type="text"
              defaultValue={component.name}
              mix={[on("change", (event) => {
                const value = (event.currentTarget as HTMLInputElement).value
                  .trim();
                if (save !== undefined && value !== "") {
                  update(renameComponent(save, component.id, value));
                }
              })]}
            />
          </td>
          <td>{component.width}×{component.height}</td>
          <td>{component.width * component.height}</td>
          <td class="pins">
            {component.pins.map((p) => `${p.name}:${p.side}${p.index}`).join(
              " ",
            )}
          </td>
          <td>
            {users.length > 0
              ? (
                <span class="muted" title={users.join(", ")}>
                  使用中 ({users.length})
                </span>
              )
              : (
                <button
                  type="button"
                  mix={[on("click", () => {
                    if (save === undefined) return;
                    if (!confirm(`「${component.name}」を削除しますか？`)) {
                      return;
                    }
                    const next = removeComponent(save, component.id);
                    if (next !== undefined) {
                      update(next, `「${component.name}」を削除しました。`);
                    }
                  })]}
                >
                  削除
                </button>
              )}
          </td>
        </tr>
      );
    }

    return () => {
      if (save === undefined) return <p>読み込み中…</p>;
      const current = save;
      const groups = STAGES
        .map((stage) => ({
          stage,
          components: current.components.filter((c) => c.stageId === stage.id),
        }))
        .filter((g) => g.components.length > 0);
      return (
        <div class="library">
          <div class="library-actions">
            <button type="button" mix={[on("click", exportSave)]}>
              エクスポート (JSON)
            </button>
            <label class="import">
              インポート
              <input
                type="file"
                accept="application/json,.json"
                mix={[on("change", (event) => {
                  const input = event.currentTarget as HTMLInputElement;
                  importSave(input.files?.[0]);
                  input.value = "";
                })]}
              />
            </label>
            <button
              type="button"
              class="danger"
              mix={[on("click", () => {
                if (confirm("部品、下書き、記録をすべて消しますか？")) {
                  update(emptySave(), "すべて消しました。");
                }
              })]}
            >
              すべて消す
            </button>
          </div>
          {message ? <p class="message">{message}</p> : null}
          {groups.length === 0
            ? (
              <p>
                まだ部品がありません。<a
                  href={current ? `${handle.props.base || ""}/` : "/"}
                >
                  ステージ
                </a>をクリアして登録すると、ここに並びます。
              </p>
            )
            : groups.map((g) => (
              <section key={g.stage.id}>
                <h2>
                  {g.stage.title}
                  <small>
                    自己ベスト {current.best[g.stage.id]}
                  </small>
                </h2>
                <table>
                  <thead>
                    <tr>
                      <th>名前</th>
                      <th>大きさ</th>
                      <th>面積</th>
                      <th>端子</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>{g.components.map(row)}</tbody>
                </table>
              </section>
            ))}
        </div>
      );
    };
  },
);
