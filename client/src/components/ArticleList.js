import ".././App.css";
import React from "react";
import { renderArticle } from './Article';
import { getPsychiatryArticles } from '../util/getPsychiatryArticles'
import { getMachineLearningArticles } from "../util/getMachineLearningArticles";
import { getTherapyArticles } from "../util/getTherapyArticles";
import { getDataScienceArticles } from "../util/getDataScienceArticles";

const psychiatryArticles = getPsychiatryArticles();
//const machineLearningArticles = getMachineLearningArticles();
//const therapyArticles = getTherapyArticles();
//const dataScienceArticles = getDataScienceArticles();

export function ArticleList() {

    return (
        <div>
            {psychiatryArticles.map(article =>
                <div>
                    {renderArticle(article)}
                </div>)
            }
        </div>
    );
}
