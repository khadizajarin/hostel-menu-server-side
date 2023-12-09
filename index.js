const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lzj0eku.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const mealCollection = client.db('hostelPro').collection('meals');
    const usersCollection = client.db('hostelPro').collection('users');
    const requestCollection = client.db('hostelPro').collection('requests');
    const upcomingCollection = client.db('hostelPro').collection('upcomings');



     // jwt related api
     app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

     // using verifyAddmin after verifyToken
     const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }



       //CRUB operation for meals
       app.get('/meals', async(req, res) => {
        const cursor = mealCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      })

      app.get('/meals/:id', async(req, res) => {
        const id = parseInt(req.params.id);
        const query = {_id : id}
        const result = await mealCollection.findOne(query);
        res.send(result);
      }) 

      app.get('/meals/:id/reviews', async (req, res) => {
        const id = parseInt(req.params.id);
        const query = { _id: id };
        const meal = await mealCollection.findOne(query);
      
        if (!meal) {
          return res.status(404).json({ error: 'Meal not found' });
        }

        const result = meal.reviews || []; 
        res.send({ meal, result });
      });

      app.post('/meals/:id/reviews', async (req, res) => {
        const id = parseInt(req.params.id);
        const query = { _id: id };
        const meal = await mealCollection.findOne(query);
      
        if (!meal) {
          return res.status(404).json({ error: 'Meal not found' });
        }
      
        const reviewData = req.body; 
        meal.reviews = meal.reviews || [];
        meal.reviews.push(reviewData);
 
        await mealCollection.updateOne(query, { $set: { reviews: meal.reviews } });
      
        res.status(200).json({ message: 'Review added successfully!', meal: meal });
      });
      app.post ('/meals', async(req, res) => {
        const newUser = req.body;
        const result = await mealCollection.insertOne(newUser);
        res.send(result);
      })
      


       // requested collection
    app.get('/requests', async (req, res) => {
      const result = await requestCollection.find().toArray();
      res.send(result);
    });

    app.post('/requests',verifyToken, async (req, res) => {
      const requestMeal = req.body;
      console.log(requestMeal)
      const result = await requestCollection.insertOne(requestMeal);
      res.send(result);
    });

    // app.delete('/requests/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) }
    //   const result = await requestCollection.deleteOne(query);
    //   res.send(result);
    // });



    //upcoming collection
    app.get('/upcomings', async (req, res) => {
      const result = await upcomingCollection.find().toArray();
      res.send(result);
    });

      //user CRUB OPERATIONS
      // app.post ('/users',verifyToken,verifyAdmin, async(req, res) => {
      //   const newUser = req.body;
      //   const result = await usersCollection.insertOne(newUser);
      //   res.send(result);
      // })

      // app.get('/users',verifyToken, async(req, res) => {
      //   // console.log(req.headers);
      //   const cursor = usersCollection.find();
      //   const result = await cursor.toArray();
      //   res.send(result);
      // }) 

      app.get('/users/admin', async (req, res) => {
        const cursor = usersCollection.find({ role: 'admin' }); 
        const result = await cursor.toArray();
        res.send(result);
      });


    // users related api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthhorized access!' })
      }
      const query = { email: email };
      // console.log(query);
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })






    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('I believe that hard work pays off');
})

app.listen(port , () => {
    console.log(`job seeker server is running on port ${port}`);
})
