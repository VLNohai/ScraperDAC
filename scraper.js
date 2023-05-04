const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const utils = require('./utils');

function cleanTitle(title) {
  return title.replace(/[^a-zA-Z0-9()]+/g, '+')
              .replace(/\(\d{4}\)/g, '')
              .replace(' ', '+')
              .trim();
}

async function filelist(title){
    const browser = await puppeteer.launch({ headless : 'new' });
    const page = await browser.newPage();
    await page.goto('https://filelist.io');
    await page.waitForNetworkIdle();

    await page.click('#username');
    await page.type('#username', 'Endiuss');
    await page.click('#password');
    await page.type('#password', 'Distrugat0ru');
    await page.click('body > form > div > div > div:nth-child(2) > div:nth-child(8) > input'),
    await page.waitForNetworkIdle();

    const newUrl = 'https://filelist.io/browse.php' + '?search=' + cleanTitle(title) + "&cat=9&searchin=1&sort=4";
    await page.goto(newUrl);
    await page.waitForNetworkIdle();

    const torrents = await page.$$('.torrentrow');
    if(torrents.length > 0){
      let currentBestText = '';
      let currentBestHref = '';
      let index = 0;
      for(let torrent of torrents){
        const torrentTitle = await torrent.$('b');
        const innerText = await torrentTitle.evaluate(title => title.textContent);
        const link = await torrent.$$('a');
        const href = await link[1].evaluate(link => link.href);
        if(index == 0){
          currentBestText = innerText;
          currentBestHref = href;
        }
        else{
          if(
            utils.stringDistance(title, utils.removeAfterLastDash(innerText)) <
            utils.stringDistance(title, utils.removeAfterLastDash(currentBestText))
          ){
            currentBestText = innerText;
            currentBestHref = href;
          }
        }
      }
      browser.close();
      return {name : currentBestText, torrentLink : currentBestHref};
    }else{
      browser.close();
      return null;
    }
    
}

async function igdb(term){
    const browser = await puppeteer.launch({ headless : "new" });
    const page = await browser.newPage();
    await page.goto('https://www.igdb.com/');
    await page.waitForNetworkIdle();

    await page.click('#search');
    await page.type('#search', term);

    try{
      await page.waitForSelector('div.panel-body.nopad', {timeout : 10000});
    }catch(error){
      console.log('selector failed, continue anyway');
    }
    await page.waitForNetworkIdle();

    const selector1 = 'div.panel-body.nopad > a:nth-child(1)';
    const selector2 = 'div.panel-body.nopad > h4';
    
    try {
      const element = await Promise.race([
        page.waitForSelector(selector1),
        page.waitForSelector(selector2)
      ]);
      const tagName = await page.evaluate(element => element.tagName, element);
      if(tagName === 'A') {
        let games = [];
        const titles = await page.$$('.igdb-autocomplete-title');
        let index = 0;
        for (const title of titles) {
          const text = await page.evaluate(element => element.textContent, title);
          if(index > 0){
            games.push({title : text, photo : null});
          }
          index++;
        }
        const elements = await page.$$('.media.nomar.igdb-autocomplete-all-suggest');
        index = 0;
        for (const element of elements) {
          const image = await element.$('img');
          const src = await image.evaluate(img => img.src);
          games[index].photo = src;
          index++;
        }
        browser.close();
        return games;
      }
      else{
        console.log('term ' + term + 'gives no results');
        browser.close();
        return null;
      }
    } catch (error) {
      console.log(`No element found with selector: ${selector1} or ${selector2}`);
      console.log(error);
      browser.close();
      return null;
    }
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// handle requests
app.get('/igdb', (req, res) => {
  igdb(decodeURIComponent(req.query.term)).then((games) =>{
    res.end(JSON.stringify(games));
  })
});

app.get('/filelist', (req, res) => {
  filelist(decodeURIComponent(req.query.term)).then((game) =>{
    res.end(JSON.stringify(game));
  })
});

// start the server
app.listen(3000, () => {
  console.log('Server started on port 3000');
});

