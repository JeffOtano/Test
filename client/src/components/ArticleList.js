import ".././App.css";
import React, { useEffect, useState } from "react";
import { renderArticle } from './Article';
import { getPsychiatryArticles } from '../util/getPsychiatryArticles'
import { getMachineLearningArticles } from "../util/getMachineLearningArticles";
import { getTherapyArticles } from "../util/getTherapyArticles";
import { getDataScienceArticles } from "../util/getDataScienceArticles";

export function ArticleList() {
    const [psychiatryArticles, setPsychiatryArticles] = useState([])
    getPsychiatryArticles().then(res => setPsychiatryArticles(res));

    const [machineLearningArticles, setMachineLearningArticles] = useState([])
    const [therapyArticles, setTherapyArticles] = useState([])
    const [dataScienceArticles, setDataScienceArticles] = useState([])


    return (
        <div>
            <h1 style={{color: 'black'}}>Article List</h1>
            {psychiatryArticles && psychiatryArticles.map((article,index) =>
                <div key={index}>
                    {renderArticle(article)}
                </div>)
            }
        </div>
    );
}

function sortBydate(articles){
    function customSort(x,y){
        let dateOne = new Date(x.children[2].value);
        let dateTwo = new Date(y.children[2].value);
        return dateOne > dateTwo ? 1 : -1;
    }

    articles.sort((x,y) => customSort(x,y));
    return articles;
}