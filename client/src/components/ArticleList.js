import ".././App.css";
import React, { useEffect, useState } from "react";
import { renderArticle } from './Article';
import { getPsychiatryArticles } from '../util/getPsychiatryArticles'
import { getMachineLearningArticles } from "../util/getMachineLearningArticles";
import { getTherapyArticles } from "../util/getTherapyArticles";
import { getDataScienceArticles } from "../util/getDataScienceArticles";

export default function ArticleList() {
    const [psychiatryArticles, setPsychiatryArticles] = useState([])
    getPsychiatryArticles().then(res => setPsychiatryArticles(res));

    const [machineLearningArticles, setMachineLearningArticles] = useState([])
    getMachineLearningArticles().then(res => setMachineLearningArticles(res));

    const [therapyArticles, setTherapyArticles] = useState([])
    getTherapyArticles().then(res => setTherapyArticles(res));

    const [dataScienceArticles, setDataScienceArticles] = useState([])
    getDataScienceArticles().then(res => setDataScienceArticles(res));

    return (
        <div>
            <h3 style={{ color: 'black' }}>Psychiatry Articles</h3>
            {psychiatryArticles && psychiatryArticles.map((article, index) =>
                <div key={index}>
                    {renderArticle(article)}
                </div>)
            }
            <h3 style={{ color: 'black' }}>Data Science Articles</h3>
            {dataScienceArticles && dataScienceArticles.map((article, index) =>
                <div key={index}>
                    {renderArticle(article)}
                </div>)
            }
            <h3 style={{ color: 'black' }}>Machine Learning Articles</h3>
            {machineLearningArticles && machineLearningArticles.map((article, index) =>
                <div key={index}>
                    {renderArticle(article)}
                </div>)
            }
            <h3 style={{ color: 'black' }}>Therapy Articles</h3>
            {therapyArticles && therapyArticles.map((article, index) =>
                <div key={index}>
                    {renderArticle(article)}
                </div>)
            }
        </div>
    );
}

function sortBydate(articles) {
    function customSort(x, y) {
        let dateOne = new Date(x.children[2].value);
        let dateTwo = new Date(y.children[2].value);
        return dateOne > dateTwo ? 1 : -1;
    }

    articles.sort((x, y) => customSort(x, y));
    return articles;
}