const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quotation-review', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing users (optional - comment out if you want to keep existing users)
    // await User.deleteMany({});

    // Create test users
    const seller = await User.findOne({ email: 'seller@test.com' });
    if (!seller) {
      const newSeller = new User({
        name: 'Test Seller',
        email: 'seller@test.com',
        password: 'seller123',
        role: 'seller'
      });
      await newSeller.save();
      console.log('✅ Seller user created: seller@test.com / seller123');
    } else {
      console.log('ℹ️  Seller user already exists: seller@test.com / seller123');
    }

    const buyer = await User.findOne({ email: 'buyer@test.com' });
    if (!buyer) {
      const newBuyer = new User({
        name: 'Test Buyer',
        email: 'buyer@test.com',
        password: 'buyer123',
        role: 'buyer'
      });
      await newBuyer.save();
      console.log('✅ Buyer user created: buyer@test.com / buyer123');
    } else {
      console.log('ℹ️  Buyer user already exists: buyer@test.com / buyer123');
    }

    console.log('\n📋 Test Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SELLER:');
    console.log('  Email: seller@test.com');
    console.log('  Password: seller123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('BUYER/ADMIN:');
    console.log('  Email: buyer@test.com');
    console.log('  Password: buyer123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();


