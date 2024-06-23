const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection setup
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://prerna_trip:WlFtsjAxFDscXPT7@cc-sub-discount.ebgalzu.mongodb.net/counter-culture', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected at ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process with failure
  }
};

// Connect to MongoDB
connectDB();

// Middleware
app.use(bodyParser.json());

// Root route handler
app.get('/', (req, res) => {
  res.send('Welcome to the webhook server!');
});

// Webhook route handler
app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', req.body);

  try {
    // Save the payload directly to MongoDB without validation
    const savedPayload = await mongoose.connection.db.collection('webhook_payloads').insertOne(req.body);
    console.log('Webhook payload saved:', savedPayload);

    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error saving webhook payload:', err);
    res.sendStatus(500); // Respond with an error status
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
