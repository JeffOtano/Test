import * as React from 'react';
import { styled } from '@mui/material/styles';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

export function renderArticle(article) {
  const content = <a style={{color: 'black' , padding: "20px"}} href={article.children[0].value} >{article.children[4].value}</a>
  console.log(article);
  return (
    <div style={{padding: '20px'}}>
      {content}
      <Divider />
    </div>
  );
}
 