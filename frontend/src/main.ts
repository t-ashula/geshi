import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="app">
    <div class="hero">
      <p class="eyebrow">Geshi Frontend</p>
      <h1>Web UI bootstrap.</h1>
      <p class="lead">
        Frontend, backend, and CLI are initialized as separate roots.
      </p>
    </div>
  </main>
`;
