const fs = require('fs')
const puppeteer = require('puppeteer')
const moment = require('moment')

const start = moment('2019-01-01T00:00:00Z')
const end = moment('2019-12-31T00:00:00Z')

if (!process.env['ELECTRICITYMAPTOKEN']) {
  throw Error('ELECTRICITYMAPTOKEN env variable is missing.');
}

async function capture(browser, moment) {
  let datetime = moment.format('YYYYMMDDTHHmm')
  let path = `screenshots/europe_2019/em_${datetime}.png`
  // let path = `screenshots/world_2018/em_${datetime}.png`
  if (fs.existsSync(path)) { return; }
  let url = `http://localhost:8000/?wind=true&solar=false&page=map&remote=true&datetime=${moment.toISOString()}`
  // console.log(url);
  let page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 })
  await page.setCookie({
    name: 'electricitymap-token',
    value: process.env['ELECTRICITYMAPTOKEN'],
    url: url,
    session: false,
    expires: moment.utc().add(1, 'hour').valueOf()
  })
  await page.setCookie({
    name: 'onboardingSeen',
    value: 'true',
    url: url,
    session: false,
    expires: moment.utc().add(1, 'hour').valueOf()
  })
  // await page.setCookie({
  //   name: 'brightModeEnabled',
  //   value: 'false',
  //   url: url,
  //   session: false,
  //   expires: moment.utc().add(1, 'hour').valueOf()
  // })
  try {
    await page.goto(url);
    await page.waitForSelector('#loading', { hidden: true })
    const hasWarning = await page.evaluate("document.getElementById('connection-warning').className.includes('active')");
    if (hasWarning) {
      throw new Error(`${url} shows connection warning :/`);
    }
    const hasWind = await page.evaluate("document.getElementById('wind').style.display !== 'none'");
    if (!hasWind) {
      throw new Error(`${url} has not wind :/`);
    }
    await page.waitFor(10000) // wait for wind to reach stationary state
    await page.screenshot({ path })
  } catch (e) {
    throw new Error(`${url} failed.\n${e}`);
  }
  console.log(moment.toISOString(), 'done..')
  await page.close()
}

const BATCH_SIZE = 5;

(async () => {
  console.log('Launching browser..')
  const browser = await puppeteer.launch();
  console.log('Starting iteration..')

  let jobs = []

  try {

    for (
      let now = moment(start);
      now.valueOf() <= moment(end).valueOf();
      now.add(1, 'hour'))
    {

      jobs.push(capture(browser, moment(now)))
      if (jobs.length > BATCH_SIZE) {
        await Promise.all(jobs)
        jobs = []
      }

    }

    await Promise.all(jobs)

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close()
  }
})();
