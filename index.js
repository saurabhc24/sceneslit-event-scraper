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
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto("https://district.in/events", {
    waitUntil: "networkidle"
  });

  await page.waitForTimeout(6000);

  const events = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-testid="event-card"]');

    return Array.from(cards).map(card => {
      const title = card.querySelector("h3")?.innerText || "";
      const link = card.querySelector("a")?.href || "";

      return {
        title,
        source_url: link,
        source_platform: "district"
      };
    });
  });

  await browser.close();
  return events;
}

async function scrapeBookMyShow() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto("https://in.bookmyshow.com/explore/events-bengaluru", {
    waitUntil: "networkidle"
  });

  await page.waitForTimeout(6000);

  const events = await page.evaluate(() => {
    const cards = document.querySelectorAll("a[href*='/events/']");

    return Array.from(cards).slice(0, 20).map(card => ({
      title: card.innerText.trim(),
      source_url: card.href,
      source_platform: "bookmyshow"
    }));
  });

  await browser.close();
  return events;
}

app.post("/scrape", async (req, res) => {
  try {
    const district = await scrapeDistrict();
    const bms = await scrapeBookMyShow();

    const events = [...district, ...bms];

    console.log("District:", district.length);
    console.log("BMS:", bms.length);
    
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
