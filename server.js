import express from 'express';
import gplay from 'google-play-scraper';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseRatings = (ratingStr) => {
  const ratings = [];
  if (ratingStr.includes('-')) {
    const [start, end] = ratingStr.split('-').map(Number);
    for (let i = start; i <= end; i++) {
      ratings.push(i);
    }
  } else {
    ratings.push(Number(ratingStr));
  }
  return ratings;
};

const fetchReviews = async (appId, allowedRatings, limit) => {
  const allReviews = await gplay.reviews({
    appId,
    sort: gplay.sort.NEWEST,
    num: limit
  });

  return allReviews.data.filter(review => allowedRatings.includes(review.score));
};

const saveToExcel = async (reviews, fileName) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Filtered Reviews');

  worksheet.columns = [
    { header: 'User', key: 'userName', width: 30 },
    { header: 'Rating', key: 'score', width: 10 },
    { header: 'Review', key: 'text', width: 100 },
    { header: 'Date', key: 'date', width: 20 },
  ];

  reviews.forEach(review => {
    worksheet.addRow({
      userName: review.userName,
      score: review.score,
      text: review.text,
      date: review.date
    });
  });

  const filePath = path.join(__dirname, 'downloads', fileName);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

// Main route
app.get('/fetch-reviews', async (req, res) => {
  const { appId, rating = '1', limit = 100 } = req.query;

  if (!appId) {
    return res.status(400).send('❌ appId is required');
  }

  const ratings = parseRatings(rating);
  const limitNum = Math.min(Number(limit), 5000); // Optional limit cap

  try {
    const reviews = await fetchReviews(appId, ratings, limitNum);
    const fileName = `${appId.replace(/\./g, '_')}_${rating}_stars.xlsx`;

    const filePath = await saveToExcel(reviews, fileName);
    res.download(filePath, fileName, () => {
      fs.unlink(filePath, () => {}); // Clean up file after sending
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('❌ Failed to fetch reviews');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
