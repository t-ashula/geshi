import { Routes, Route } from "react-router-dom";
import "./App.css";

// 仮のコンポーネント
const Home = () => <div>ホームページ</div>;
const Transcribe = () => <div>文字起こしページ</div>;
const Summarize = () => <div>要約ページ</div>;
const NotFound = () => <div>404 - ページが見つかりません</div>;

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Geshi - 文字起こしと要約</h1>
        <nav>
          <ul>
            <li>
              <a href="/">ホーム</a>
            </li>
            <li>
              <a href="/transcribe">文字起こし</a>
            </li>
            <li>
              <a href="/summarize">要約</a>
            </li>
          </ul>
        </nav>
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transcribe" element={<Transcribe />} />
          <Route path="/summarize" element={<Summarize />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>&copy; 2025 Geshi Project</p>
      </footer>
    </div>
  );
}

export default App;
