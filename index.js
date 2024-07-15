const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const RECHARGE_API_KEY = 'sk_test_2x2_b69d7aa3fe6f2600f0375946b77f8eb00dd2bf034133a9bd9702efd3bb2b3400'
const MONGO_COLLECTION = 'sub_payloads_3'
// const MONGO_COLLECTION = 'webhooks'

// MongoDB connection setup
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://prerna_trip:WlFtsjAxFDscXPT7@cc-sub-discount.ebgalzu.mongodb.net/counter-culture' , {
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



//List of Products that Qualify for the Discount
const productsQualifiedForDiscount = [7046600589363, 7046612353075, 7046607831091, 7046618611763, 7046617956403]



// Webhook - subscription/created
app.post('/subscription', async (req, res) => {
  console.log('========= *** =========');
  console.log('---- Received subscription/created webhook ----');
  console.log('========= *** =========');

  try {
    // Save the payload to MongoDB
    const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
    console.log('Webhook payload saved:', savedPayload);
    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error saving webhook payload:', err);
    res.sendStatus(500); // Respond with an error status
  }

  let subscription_id = req.body.subscription.id;
  let product_title = req.body.subscription.product_title;
  let product_price = req.body.subscription.price;
  let product_id = req.body.subscription.shopify_product_id;

  console.table({
    "subscription_id": subscription_id,
    "product_title": product_title,
    "product_price": product_price,
    "product_id": product_id

  });

  console.log('Subscription ID for product ', product_title , 'is ===>', subscription_id);

  try {
    // Get all charges for this subscription ID
    const chargeHeaders = new Headers();
    chargeHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

    const requestOptions = {
      method: "GET",
      headers: chargeHeaders
    };

    const response = await fetch(`https://api.rechargeapps.com/charges?subscription_id=${subscription_id}`, requestOptions);
    const chargeRes = await response.json();

    console.log(`****** RETRIEVED CHARGES FOR THE SUBSCRIPTION with subscription ID: ${subscription_id} ******`);
    //console.log(chargeRes);

  

    // Separate the charges into CHECKOUT and RECURRING arrays
    let checkoutCharges = null;
    let recurringCharges = null;

    chargeRes.charges.forEach((charge) => {
      if (charge.type === 'CHECKOUT') {
        checkoutCharges = charge;
      } else if (charge.type === 'RECURRING') {
        recurringCharges = charge;
      }
    });


    
    if (checkoutCharges) {
      console.log(`checkoutCharges for ${subscription_id} ${product_title} ===>`, checkoutCharges.discount_codes ? checkoutCharges.discount_codes : [], checkoutCharges.line_items.map((item) => item.title));
    }
    if (recurringCharges) {
      console.log(`recurringCharges for ${subscription_id} ${product_title} ===>`, recurringCharges.discount_codes ? recurringCharges.discount_codes : [], recurringCharges.line_items.map((item) => item.title));
    }


    let subQualifiesForDiscount = false;

    

    if (checkoutCharges) {
      console.log(`----- This charge is of type CHECKOUT (subscription/created) for ${product_title} -----`);


      //Add  a check here to see if the Product Qualifies for discount (because discount code is applied at charge level)
      if (checkoutCharges.discount_codes && checkoutCharges.discount_codes.length > 0 && checkoutCharges.discount_codes[0].code === 'TEST_SUB_5' && productsQualifiedForDiscount.includes(product_id)) {
        console.log('------- This charge qualifies for TIERED DISCOUNT ------');
        console.log('adding properties to subscription object...');


        //TODO: Save the original subscription price in a property to access later


        console.log('DONE: Check this for all line items not just one');
        //let subscription_id = checkoutCharges.line_items[0].subscription_id;
        let charge_id = checkoutCharges.id;

        subQualifiesForDiscount = true;

        console.table({
          "subscription_id": subscription_id,
          "charge_id": charge_id
        });

        const subscriptionHeaders = new Headers();
        subscriptionHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
        subscriptionHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify({
          "properties": [
            {
              "name": "qualifies for tiered discount",
              "value": true
            },
            {
              "name": "original subscription price",
              "value": product_price
            },
            {
              "name": "charges with discount applied",
              "value": 2
            }
          ]
        });

        

        const requestOptions = {
          method: "PUT",
          headers: subscriptionHeaders,
          body: raw
        };

        await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, requestOptions);
        console.log(`** Added properties to the Subscription object for ${product_title} **`);

        
      }
    }

    console.log(`${product_title} qualifies for discount  ====> ${subQualifiesForDiscount}`);
    // Processing of CHECKOUT charges is complete. Now starting to process RECURRING charges.
    console.log('----- Processing of CHECKOUT charges is complete. Starting to process RECURRING charges -----');


    if (recurringCharges) {
      console.log(`----- This charge is of type RECURRING (subscription/created) for ${product_title}  -----`);

      //let subscription_id = recurringCharges.line_items[0].subscription_id; //bruhhhhhhhhhhh....
      let charge_id = recurringCharges.id;

      if(subQualifiesForDiscount){
        //TODO: Error is somewhere here
        console.log(`-- subQualifiesForDiscount: ${subQualifiesForDiscount}  ==> Adding 20% off to recurring charge for ${product_title} since this Subscription qualifies for a discount --`);

        const chargeCountHeaders = new Headers();
        chargeCountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

        const requestOptions = {
          method: "GET",
          headers: chargeCountHeaders
        };

        const response = await fetch(`https://api.rechargeapps.com/charges/count?subscription_id=${subscription_id}`, requestOptions);
        const result = await response.json();
        const count = result.count;
        console.log('Charge Count for this subscription so far is...', count);


        //Instead of applying a discount to the charge, change the price of the subscription instead:
        console.log('====== *** ======');
        console.log('Updating the Value of the Subscription  ...');
        console.log(`Current price for ${product_title} is ${product_price} for ${subscription_id}`);

        let discounted20Price = product_price * 0.8;

        const discountHeaders = new Headers();
        discountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
        discountHeaders.append("X-Recharge-Version", "2021-11");
        discountHeaders.append("Content-Type", "application/json");

        const discountedPrice = JSON.stringify({
          "price": discounted20Price
        });

        const discReqOptions = {
          method: "PUT",
          headers: discountHeaders,
          body: discountedPrice,
          redirect: "follow"
        };

        try {
          const response = await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, discReqOptions);
          const result = await response.json();
          console.log(`Applied 20% disocunt to ${product_title} for the charge number ${count} . Updated price is now ===> ${discountedPrice}`);
        } catch (error) {
          console.error(error);
        }

      }
      else{
        console.log(`-- NO DISCOUNT FOR THE FIRST RECURRING ORDER(subscription/created) for ${product_title}  --`);
      }

    }


    console.log('----- Processing of RECURRING charges is complete. -----');

  } catch (error) {
    console.error(error);
  }
});




// Webhook - charge/created
app.post('/charge', async (req, res) => {
  console.log('========= *** =========');
  console.log('Received charge/created webhook ');
  console.log('========= *** =========');

  try {
    // Save the payload to MongoDB
    const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
    console.log('Webhook payload saved:', savedPayload);

    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error saving webhook payload:', err);
    res.sendStatus(500); // Respond with an error status
    return;
  }

  if (req.body.charge.type === 'RECURRING') {
    console.log('----- This charge is of type RECURRING (charge/created) -----');

    let charge_id = req.body.charge.id;

    for (const [index, line_item] of req.body.charge.line_items.entries()) {
      console.log(`Subscription ID for ${index} ===> ${line_item.subscription_id}`);
      console.log(`Product Title for ${index} ===> ${line_item.title}`);

      let subscription_id = line_item.subscription_id;
      let product_title = line_item.title;
      let product_price = line_item.price;

      // 0. Check the charge number of the charge
      const chargeCountHeaders = new Headers();
      chargeCountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

      const chargeOptns = {
        method: "GET",
        headers: chargeCountHeaders,
      };

      console.log('====== *** ======');
      console.log(`Making a request to check the charge count for ${product_title}...`);

      try {
        const chargeResponse = await fetch(`https://api.rechargeapps.com/charges/count?subscription_id=${subscription_id}`, chargeOptns);
        const chargeResult = await chargeResponse.json();
        const count = chargeResult.count;
        console.log(`Charge Count for this subscription (inside charge/created webhook) for ${product_title} so far is...`, count);

        // Only proceed if the charge count is equal to or more than 3
        if (count >= 3) {
          console.log(`** TAKING ACTION for this charge/created webhook for ${product_title} as the charge count is more than or equal to 3 **`);

          // 1. Check the properties of the subscription and see if it qualifies for a discount
          const subPropertyHeaders = new Headers();
          subPropertyHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);

          const requestOptions = {
            method: "GET",
            headers: subPropertyHeaders,
          };

          const subResponse = await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, requestOptions);
          const subResult = await subResponse.json();
          const subscription = subResult.subscription;

          if (subscription) {
            const allSubscriptionProperties = subscription.properties;
            console.log('allSubscriptionProperties', allSubscriptionProperties);
            const property = subscription.properties.find(prop => prop.name === 'qualifies for tiered discount');
            const originalSubPrice = subscription.properties.find(prop => prop.name === 'original subscription price');
            const chargesWithDiscount = subscription.properties.find(prop => prop.name === 'charges with discount applied');

            if (property && originalSubPrice && chargesWithDiscount) {
              console.log(`Property found: ${product_title} 'qualifies for tiered discount':`, property.value);
              console.log(`originalSubPrice for ${product_title} is ${originalSubPrice.value}`);
              console.log(`Number of Charges with Discount Applied for ${product_title} so far is ${chargesWithDiscount.value}`);

              if (property.value === true) {
                console.log('---** This RECURRING ORDER qualifies for discount **---');

                // 4. Apply discount
                console.log('====== *** ======');
                console.log('Applying the discount code ...');

                // Apply the subsequent discount based on the count
                let SUB_DISCOUNT_PERCENT = '';
                switch (chargesWithDiscount.value) {
                  case 2:
                    console.log('Discount Applied to 2 charges so far');
                    SUB_DISCOUNT_PERCENT = 30;
                    break;
                  case 3:
                    console.log('Discount Applied to 3 charges so far');
                    SUB_DISCOUNT_PERCENT = 40;
                    break;
                  case 4:
                    console.log('Discount Applied to 4 charges so far');
                    SUB_DISCOUNT_PERCENT = 50;
                    break;
                  default:
                    console.log('Count is out of range');
                }

                console.log(`Discount percentage to be applied for ${product_title} is ${SUB_DISCOUNT_PERCENT}`);
                if (SUB_DISCOUNT_PERCENT !== '') {
                  console.log(`** PROCEEDING WITH DISCOUNT CODE APPLICATION for ${product_title}`);

                  let discountedSubPrice = originalSubPrice.value * ((100 - SUB_DISCOUNT_PERCENT) / 100);
                  console.log(`Discount percentage to be applied for ${product_title} is ${SUB_DISCOUNT_PERCENT}%`);
                  console.log(`Discounted price for ${product_title} is now ${discountedSubPrice}`);

                  const discountHeaders = new Headers();
                  discountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
                  discountHeaders.append("X-Recharge-Version", "2021-11");
                  discountHeaders.append("Content-Type", "application/json");

                  let updateDiscountCharges = chargesWithDiscount.value + 1;

                  // Update the properties array
                  let updatedProperties = subscription.properties.map(property => {
                    if (property.name === "charges with discount applied") {
                      return {
                        ...property,
                        value: updateDiscountCharges
                      };
                    }
                    return property;
                  });

                  console.log('updatedProperties  ===> ', updatedProperties)

                  // Include the updated properties in the request body
                  const discountedPrice = JSON.stringify({
                    "price": discountedSubPrice,
                    "properties": updatedProperties
                  });

                  console.log(`Updated Properties for ${product_title} is ${discountedPrice}`);

                  const discReqOptions = {
                    method: "PUT",
                    headers: discountHeaders,
                    body: discountedPrice                  };

                  try {
                    const discountResponse = await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, discReqOptions);
                    const discountResult = await discountResponse.json();
                    console.log(`Applied ${SUB_DISCOUNT_PERCENT}% discount to ${product_title} for the charge number ${count}. Updated price is now ===> ${discountedPrice}`);
                  } catch (error) {
                    console.error('Error applying discount:', error);
                  }
                } else {
                  // Restore the subscription value to Original Price once all discounts are applied
                  console.log(`** ALL DISCOUNTS APPLIED: Restoring ${product_title} to its original price...`);

                  const discountHeaders = new Headers();
                  discountHeaders.append("X-Recharge-Access-Token", RECHARGE_API_KEY);
                  discountHeaders.append("X-Recharge-Version", "2021-11");
                  discountHeaders.append("Content-Type", "application/json");

                  const restorePrice = JSON.stringify({
                    "price": originalSubPrice.value,
                  });

                  const restoreReqOptions = {
                    method: "PUT",
                    headers: discountHeaders,
                    body: restorePrice,
                    redirect: "follow",
                  };

                  try {
                    const restoreResponse = await fetch(`https://api.rechargeapps.com/subscriptions/${subscription_id}`, restoreReqOptions);
                    const restoreResult = await restoreResponse.json();
                    console.log(`Restored ${product_title} to its original price: ${originalSubPrice.value}`);
                  } catch (error) {
                    console.error('Error restoring price:', error);
                  }
                }
              }
            } else {
              console.log(`Properties not found: 'qualifies for tiered discount' or 'original subscription price' or 'charges with discount applied'`);
            }
          }
        } else {
          console.log(`** NO ACTION for this charge/created webhook for ${product_title} as the charge count is less than 3 **`);
        }
      } catch (error) {
        console.error('Error fetching charge count or subscription:', error);
      }
    }
  }
});





// Webhook - subscription/skipped
app.post('/skip', async (req, res) => {


  console.log('========= *** =========');
  console.log('Received subscription/skipped webhook ');
  console.log('========= *** =========');

  console.log('Received sub/skipped webhook:', req.body);


  try {
    // Save the payload to MongoDB
    const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
    console.log('Webhook payload saved:', savedPayload);

    res.sendStatus(200); // Respond to the webhook request
  } catch (err) {
    console.error('Error saving webhook payload:', err);
    res.sendStatus(500); // Respond with an error status
  }

});



// Webhook - subscription/unskipped
app.post('/unskip', async (req, res) => {


  console.log('========= *** =========');
  console.log('Received subscription/unskipped webhook ');
  console.log('========= *** =========');

  console.log('Received sub/unskipped webhook:', req.body);


  try {
    // Save the payload to MongoDB
    const savedPayload = await mongoose.connection.db.collection(`${MONGO_COLLECTION}`).insertOne(req.body);
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
