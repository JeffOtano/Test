import "./App.css";
import React from "react";
import {ArticleList} from "./components/ArticleList";

function App() {

  return (
    <div className="App">
      <header className="App-header">
        {ArticleList()}
      </header>
    </div>
  );
}

export default App;
