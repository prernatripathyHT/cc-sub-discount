const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// MongoDB Connection URI and Database Name
const uri = 'mongodb+srv://prerna_trip:WlFtsjAxFDscXPT7@cc-sub-discount.ebgalzu.mongodb.net/';
const dbName = 'counter-culture'; // Replace with your database name

// MongoDB Client instance
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Connect to MongoDB Atlas
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('Error connecting to MongoDB Atlas:', err);
  }
}

// Root route handler
app.get('/', (req, res) => {
  res.send('Welcome to the webhook server!');
});

// Webhook route handler
app.post('/webhook', async (req, res) => {
  console.log('========= *** =========');
  console.log('Received webhook:', req.body);

  // Example: Inserting data into MongoDB
  try {
    // Ensure the database connection is established
    if (!client.isConnected()) {
      await connectToMongoDB();
    }

    // Use the specified database
    const database = client.db(dbName);

    // Example: Inserting webhook data into a collection named 'webhooks'
    const collection = database.collection('webhooks');

    // Insert the received webhook data into MongoDB
    const result = await collection.insertOne(req.body);
    console.log(`Inserted ${result.insertedCount} document into the collection`);

    // Optionally, perform additional operations based on the webhook data
    let subscription_id = req.body.charge.line_items[0].subscription_id;
    let charge_id = req.body.charge.id;

    console.table({
      "subscription_id": subscription_id,
      "charge_id": charge_id
    });

    if (req.body.charge.discount_codes[0].code === 'TIERED_SUB_5') {
      console.log('This customer qualifies for Tiered discount');
      // Add logic to apply discounts, update customer tags, etc.
    }

    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error handling webhook:', err);
    res.sendStatus(500); // Respond with an error status
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  connectToMongoDB(); // Connect to MongoDB when the server starts
});

// Handle process termination gracefully
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB Atlas connection closed');
  process.exit(0);
});
