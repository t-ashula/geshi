# ADR-0031: route handler のテスト容易性を interface 境界と Hono 依存の隔離で高める に対するメモ

## app, routes 周りの設計変更

### 現状

- `src/app.ts` で app (Hono instance) を，それぞれの routes の関数に渡して，処理を追加させている
- それぞれの routes の関数は `src/routes/api/v1/contents.ts` などで app と service のインスタンスを受け取って，ハンドラを設定している
- handler の設定は `app.get("/api/v1/content", () =>{})` となっている

### 課題

- app をそれぞれに渡してるので，あとの route の方でハンドラを上書きしててもわからない
  - 上書きに意味があるかもしれないが，普通は責務の逸脱でよろしくない
- それぞれの handler の挙動を検証するために， app 全体の組み立てが必要
  ‐ `/api/v1/` の url の事情が見えすぎているし，パスとあってなくてもわからない
  - `app.get("/api/vi/content",() => {})` でもわからない
- ハンドラが直書きなので，それ自体の検証のためだけに，app 全体を作ったうえでのテストになってしまう

### 変更

- route の段階分離は，必ずしも router を深く入れ子にすること自体を目的にしない
- 守りたいのは，次の点である
  - 上位の app が下位の routing を登録する
  - 下位の routes に app instance を引き回さない
- つまり，`src/app.ts` から route module を読み込み，その route module が自分の責務範囲の routing を閉じた形で持つ構成であればよい
- router の分割粒度は，`api` / `v1` / resource ごとのように段階化してもよいし，そこまで細かくしなくてもよい
- 重要なのは，登録責務の向きが常に上位 -> 下位になることと，route module が親 app の可変な状態を直接触らないことである
  - 例:

    ```ts
    // src/app.ts
    import { Hono } from "hono";
    import sourcesRoutes from "./routes/api/v1/sources.js";

    const app = new Hono();
    app.route("/api/v1/sources", sourcesRoutes);
    export default app;
    ```

    ```ts
    // src/routes/api/v1/sources.ts
    import { Hono } from "hono";
    import { createListSourcesHandler } from "../../handlers/sources.js";

    const router = new Hono();
    router.get("/", createListSourcesHandler(/* dependencies */));
    export default router;
    ```

コントローラーより先をどうするかが課題

```ts
// src/controllers/contents.ts
// Hono.Context に強く依存するし
import { Context } from "hono";
// ここで service を import してしまっては，handlers の挙動を vitest.mock("path/to/foo/bar.js", ...) しないと制御できない？
import { service } from "src/services/contents.js";
const handlers = {
  getList: async (c: Context) => {
    const args = {
      /** build arguments via Context */
    };
    const r = service.getContents(args);
    if (!r.ok) {
      return c.json({ error: r.error }, 404 /** or 500 ?  */);
    }
    return c.json({ contents: r.value }, 200);
  },
};
export default handlers;
```

サービスもどうするかが問題

```ts
// src/services/contents.ts
import { repository } from "src/repository/contents.js";
const service = {
  getContents: async (args) => {
    const r = await repository.getContents(args);
    if (!r.ok) {
      return r;
    }
    return ok(r.value);
  },
};
export default service;
```

## 論点の整理

- route の登録単位を分けること自体は有用だが，それだけでは testability は大きく改善しない
- 実際に test を難しくしている主因は，次の 2 点である
  - handler が依存をどう受け取るか
  - handler の業務分岐が `Hono.Context` にどこまで縛られるか
- `app.route()` を使って router を段階的に組み立てる構成は，path ごとの責務分離や見通しの改善には効く
- しかし，handler の中で concrete な service を import したり，`Context` の読み書きと業務分岐が一体化している限り，unit test では module mock や app 全体の組み立てに寄りやすい
- したがって，routing の再編だけを主題にすると課題の芯を外す
- 主題は，HTTP adapter と application logic の境界，および dependency injection の方式である

## いま見えている課題

### 1. handler が concrete 実装へ直接依存しやすい

- `service` を module import すると，handler test で差し替えるには module mock へ寄りやすい
- module mock でも test は書けるが，依存関係が import detail に固定され，設計上の依存方向は改善しない
- route handler が必要とする振る舞いだけを抽象にして受け取れていない

### 2. `Hono.Context` が handler の中心に入り込みやすい

- `Context` からの入力抽出，service 呼び出し，`Result` の HTTP response 変換が 1 つの関数に混ざりやすい
- その結果，HTTP 境界の都合と業務分岐の都合が分離されない
- test でも，`Context` 相当の準備がないと分岐を叩きにくくなる

### 3. route の登録責務と handler の責務が近すぎる

- route file の中に path 定義，依存 import，handler 本体が同居しやすい
- 小規模では問題が見えにくいが，API が増えると path の見通しと handler 単位の testability が同時に悪化する

## 解決策の案

### 方針

- Hono 依存は HTTP adapter 層に閉じ込める
- handler 本体は concrete 実装ではなく interface に依存させる
- route 登録，request 解釈，application service 呼び出し，response 変換を分離する

### 構成案

#### 1. register routes

- `app.route()` や `app.get()` / `app.post()` を置く場所
- path 構成と router の入れ子はここで扱う
- Hono 依存はここにあってよい
- ただし，ここには業務分岐を書かない

#### 2. handler factory

- 必要な依存を interface で受け取り，Hono handler を返す
- 例:

```ts
type ContentHandlersDependencies = {
  contentQueryService: ContentQueryService;
};

export function createGetContentListHandler(
  dependencies: ContentHandlersDependencies,
) {
  return async function getContentList(c: Context) {
    // request/response mapping only
  };
}
```

- test ではここに test double を渡す
- app 全体を組み立てなくても，handler 単位で挙動を制御しやすい

#### 3. request / response mapper

- `Context` から必要な入力を読む
- service の `Result` を HTTP status / body に写像する
- ここは Hono 依存を持ってよいが，業務判断そのものは持ち込まない
- 「入力検証」と「HTTP 表現への変換」はここに置く

#### 4. application service

- Hono 非依存
- repository / plugin / storage などを interface 越しに受ける
- `Result` を返し，期待される失敗を構造化して上位へ渡す

## route 分離案の位置づけ

- route を段階的に分ける場合でも，目的は router 階層を深くすることではない
- 守りたい最小条件は，「上位が下位を登録する」「下位へ app を引き回さない」の 2 点である
- これは path の責務分離には効く
- ただし，これだけでは handler test のしやすさは十分に改善しない
- route 分離案は，dependency injection と Hono 依存の隔離を実現するための土台として扱うのがよい

## 実装時の最小ルール案

- route module は concrete service を直接 import しない
- route module は handler factory を呼び出して app へ登録する
- handler factory は interface 群を受け取る
- service は `Context` や `Response` を知らない
- repository / plugin / storage も必要最小の interface で service に渡す
- route handler test では，test double を注入して HTTP response を検証する

## いったんの結論

- routing の再編は必要だが，主課題ではない
- 主課題は dependency injection と Hono 依存の隔離である
- 設計の中心は，`route registration`, `handler factory`, `request/response mapping`, `application service` の 4 つの分離に置くのがよい
- ADR では `interface 依存` と `route handler test` を主題にし，design log では routing 案をその補助手段として位置づけるのが自然である

## 回帰確認用 test の扱い

- 現行 API の response を正として回帰を防ぐための test は，移行作業と同時に一度作り直した方がよい
- ただし，ここで再導入する test は，旧実装の内部構造に密着した test に戻すべきではない
- 目的は，実装詳細の固定ではなく，現行の HTTP contract を固定することである
- したがって，作り直すなら次の性格に寄せるのがよい
  - Hono の request / response を通す
  - service は interface 越しの test double で差し替える
  - `status` と `response body` を固定する
  - DB 模倣や repository 実装詳細には依存しない
- これは route handler の contract test に近い位置づけであり，旧来の「実装べったり test」とは別物として扱う
- また，これらの test は移行を安全に進めるための足場であり，最終的に整理して縮小または削除する余地を残してよい
- 重要なのは「いったん作るかどうか」よりも，「何を固定するための test か」を最初に明確にしておくことである

## app.ts レベルの確認

- 個々の route module の実装とその test だけでは，その module 配下の endpoint しか見えない
- そのため，最終的に `app.ts` にどういう endpoint が登録されているはずかを検出する手段は別で持っていた方がよい
- これは integration test というほど重いものでなくてよく，app 全体の routing 構成を確認する薄い test として扱える
- 目的は，業務ロジックの検証ではなく，次のような構成上の取りこぼしを検出することである
  - route の mount 漏れ
  - prefix の誤り
  - path の打ち間違い
  - 想定した method が app に現れていないこと
- たとえば，`app` に対して既知の path / method へ request を送り，少なくとも「未登録ではない」ことを確認する程度の test はありうる
- この test は各 route handler test の代替ではなく，個別 test では見えない app 組み立て結果を補うためのものとして位置づけるのがよい

## service / repository / dependency injection の整理

- routing については，route の責務と test 単位が見えてきた
- 次に詰めるべきなのは，`service` と `repository` の責務分割，およびそれらの dependency injection の方針である
- ここが曖昧だと，route だけ分けても，結局 service や repository の import 方向で testability が崩れる

## service の責務分割案

- `service` は HTTP path 単位ではなく，application の use case 単位で分けるのがよい
- route は HTTP の入口にすぎず，service は「何をさせたいか」の単位で持つ
- たとえば，次のような分け方が考えられる
  - `SourceCommandService`
  - `SourceQueryService`
  - `ContentQueryService`
  - `JobCommandService`
  - `SettingsCommandService`
- read / write を 1 つの service に全部混ぜるより，`Command` / `Query` で分けた方が interface が細くなりやすい
- `service` は Hono 非依存とし，`Context` や `Response` を知らないようにする
- `service` は必要なら `Result` を返し，期待される失敗を構造化して上位へ渡す
- `service` の内部で repository や queue や plugin を `new` しない

## repository の責務分割案

- `repository` は原則として永続化アクセスに責務を絞る
- いまの `source-repository` / `content-repository` / `job-repository` の軸は，すぐに全面否定する必要はなさそうである
- ただし，分け方は単なる table 単位ではなく，service が必要とする永続化責務単位に寄せて見直す余地がある
- `repository` は DB access と永続化都合の吸収に専念し，業務判断を持ち込みすぎない方がよい
- `repository` の戻り値は，SQL や Kysely の都合を上位へ漏らさないようにしたい
- route や service から見て，`repository` は「必要な取得・保存ができるもの」として見えるのがよい

## dependency injection の境界

- interface は何にでも作るのではなく，上位から差し替えたい境界に絞って切るのがよい
- まず interface を切る対象は，次の境界が中心になる
  - route handler から見た service
  - service から見た repository
  - service / worker から見た plugin
  - service / worker から見た storage
  - service / worker から見た job queue
- concrete class の直接 import を減らし，依存方向を固定する
- 依存方向はおおむね次のように揃えたい
  - `routes` -> `service interface`
  - `service` -> `repository interface`, `plugin interface`, `storage interface`, `job queue interface`
  - `repository` -> DB client

## composition root の置き場

- concrete 実装の組み立ては，`app.ts` や worker の `main.ts` のような composition root に寄せるのがよい
- `route` / `handler` / `service` の中では `new` を避ける
- 依存の配線を composition root に寄せることで，利用責務と生成責務を分けやすくなる
- これにより，test では同じ interface に対して test double を差し込める

## 避けたい形

- route が service 実装を直接 import する
- service が repository 実装を直接 import して `new` する
- service が `Hono.Context` や `Response` を知る
- repository が HTTP 的な意味を返す
- repository が業務ルールの中心になる

## test 単位との対応

- route handler test
  - HTTP 入出力と response contract を確認する
  - service は interface 越しに test double で差し替える
- service test
  - use case 単位の業務分岐を確認する
  - repository / queue / plugin / storage は interface 越しに差し替える
- repository test
  - DB access の正しさを確認する
  - route や service の責務は持ち込まない
- app.ts レベルの薄い test
  - route の mount 漏れや prefix 誤りを確認する

## いったんの整理

- route の testability を高めるには，route だけでなく service / repository / DI の方針も合わせて決める必要がある
- service は use case 単位，repository は永続化責務単位，composition は `app.ts` / worker `main.ts` に寄せるのが筋がよさそうである
- 次に詰めるべきなのは，実際の `sources` / `contents` / `jobs` / `settings` で，どの service interface と repository interface が必要かの棚卸しである
