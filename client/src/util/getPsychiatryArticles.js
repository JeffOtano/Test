const axios = require('axios');
var XMLParser = require('react-xml-parser');
const PSYCHIATRY_QUERY = 'http://export.arxiv.org/api/query?search_query=all:psychiatry&start=0';

export async function getPsychiatryArticles() {
    const articles = [];
    let parser = new XMLParser();

    await axios.get(PSYCHIATRY_QUERY, {
        "Content-Type": "application/xml; charset=utf-8"
    }).then(res => {
        var parsedXml = parser.parseFromString(res.data);
    
        parsedXml.children.forEach(article => {
            if(article.name === 'entry'){
              articles.push(article);
            }
       })
    }) 

    return articles;
}

