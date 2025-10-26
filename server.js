
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const cache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const API_KEY = process.env.AVIATIONSTACK_API_KEY;
const BASE_URL = 'http://api.aviationstack.com/v1';

app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Flight Tracker Backend',
    endpoints: ['/api/flights', '/api/booking-url']
  });
});

app.get('/api/flights', async (req, res) => {
  try {
    const { dep_iata, arr_iata, flight_date } = req.query;

    if (!dep_iata || !arr_iata) {
      return res.status(400).json({ 
        error: 'Missing required parameters: dep_iata, arr_iata' 
      });
    }

    const cacheKey = `${dep_iata}-${arr_iata}-${flight_date || 'today'}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const params = {
      access_key: API_KEY,
      dep_iata,
      arr_iata,
      limit: 100
    };

    if (flight_date) params.flight_date = flight_date;

    const response = await axios.get(`${BASE_URL}/flights`, { params });

    if (response.data.error) {
      return res.status(400).json({ 
        error: response.data.error.message || 'API error' 
      });
    }

    const result = {
      data: response.data.data || [],
      count: response.data.data?.length || 0,
      route: `${dep_iata} → ${arr_iata}`,
      date: flight_date || 'today'
    };

    cache.set(cacheKey, result);
    res.json({ ...result, cached: false });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});

app.get('/api/booking-url', (req, res) => {
  const { airline, origin, dest } = req.query;
  
  const urls = {
    'Delta': `https://www.delta.com/flight-search/book-a-flight?origin=${origin}&dest=${dest}`,
    'JetBlue': `https://www.jetblue.com/booking/flights?from=${origin}&to=${dest}`,
    'American': `https://www.aa.com/booking/find-flights?origin=${origin}&dest=${dest}`,
    'United': `https://www.united.com/en/us/fsr/choose-flights?origin=${origin}&dest=${dest}`,
    'default': `https://www.google.com/flights?q=flights+from+${origin}+to+${dest}`
  };
  
  res.json({ 
    url: urls[airline] || urls.default,
    airline,
    route: `${origin} → ${dest}`
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✈️  Backend running on port ${PORT}`);
  console.log(`🔑 API Key: ${API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET'}`);
});

