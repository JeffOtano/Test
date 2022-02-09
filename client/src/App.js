import "./App.css";
import React from "react";
import {ArticleList} from "./components/ArticleList";

function App() {

  return (
    <div className="App">
      <header className="App-header">
        <h1 style={{color: 'black'}}>TEST</h1>
        {ArticleList()}
      </header>
    </div>
  );
}

export default App;
