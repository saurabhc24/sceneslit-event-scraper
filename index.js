import express from "express";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

// 🔐 Put these in Render ENV variables later
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// 🔥 Main scrape route
app.post("/scrape", async (req, res) => {
  const city = req.body.city || "Bengaluru";

  try {
    // Example test event (replace later with real scraping)
    const testEvent = {
      title: "Test Techno Night",
      description: "Automated insert test",
      city: city,
      start_datetime: new Date().toISOString(),
      price_min: 499,
      source_platform: "test_scraper",
      source_url: "https://example.com"
    };

    const { error } = await supabase
      .from("events")
      .insert([testEvent]);

    if (error) throw error;

    res.json({
      city,
      inserted: 1,
      message: "Success"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Scraper running on port 3000");
});
