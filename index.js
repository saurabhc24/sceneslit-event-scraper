import express from "express";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function scrapeDistrict() {
  const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ]
});
  const page = await browser.newPage();

  await page.goto("https://district.in/events");

  await page.waitForTimeout(5000);

  const events = await page.evaluate(() => {
    const cards = document.querySelectorAll("a");

    return Array.from(cards)
      .filter(a => a.href.includes("/event/"))
      .slice(0, 20)
      .map(a => ({
        title: a.innerText.trim(),
        source_url: a.href,
        source_platform: "district"
      }));
  });

  await browser.close();
  return events;
}

async function scrapeBookMyShow() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.goto("https://in.bookmyshow.com/explore/events-bengaluru");

  await page.waitForTimeout(5000);

  const events = await page.evaluate(() => {
    const links = document.querySelectorAll("a");

    return Array.from(links)
      .filter(a => a.href.includes("/events/"))
      .slice(0, 20)
      .map(a => ({
        title: a.innerText.trim(),
        source_url: a.href,
        source_platform: "bookmyshow"
      }));
  });

  await browser.close();
  return events;
}

app.post("/scrape", async (req, res) => {
  try {
    const [district, bms] = await Promise.all([
      scrapeDistrict(),
      scrapeBookMyShow(),
    ]);

    const events = [...district, ...bms];

    for (const event of events) {
      await supabase.from("events").upsert({
        title: event.title,
        city: "Bengaluru",
        start_datetime: new Date().toISOString(),
        source_platform: event.source_platform,
        source_url: event.source_url
      }, { onConflict: "source_url" });
    }

    res.json({
      scraped: events.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Scraper running");
});
