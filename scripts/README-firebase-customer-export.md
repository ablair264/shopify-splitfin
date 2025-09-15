# 🔥 Firebase Customer Export Guide

This guide helps you export customer data from Firebase to use with the Supabase migration script.

## 📋 Prerequisites

You need:
1. **Firebase Admin SDK service account key**
2. **Node.js** (already installed)
3. **Firebase Admin package** (install below)

## 🚀 Step-by-Step Setup

### 1. Install Firebase Admin SDK
```bash
cd /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app
npm install firebase-admin
```

### 2. Download Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **⚙️ Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate new private key**
6. Save the downloaded JSON file as:
   ```
   /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app/scripts/firebase-service-account.json
   ```

### 3. Run the Export Script
```bash
cd /Users/alastairblair/Development/Splitfin-Prod-Current-New/splitfin-app
node scripts/export-firebase-customers.js
```

## 📁 What the Script Does

1. **🔍 Searches for customer collections** with these common names:
   - `customers`
   - `customer_data` 
   - `users`
   - `contacts`
   - `clients`

2. **📋 Lists all collections** in your Firebase to help identify the right one

3. **💾 Exports data** to `firebase-export/customers.json`

4. **📊 Shows summary** of what was exported

## 🔧 If Export Fails

### Common Issues:

1. **"Collection not found"**
   - Your customer collection might have a different name
   - Check the "Available collections" output
   - Let me know the correct name

2. **"Permission denied"**
   - Make sure your service account has Firestore read permissions
   - Try regenerating the service account key

3. **"No data exported"**
   - Data might be in subcollections
   - Collection might be empty
   - Wrong Firebase project selected

## 🎯 Custom Collection Name

If your customer data is in a differently named collection, let me know and I'll update the script!

## 📞 Next Steps

Once you have `customers.json`, run the migration:
```bash
node scripts/migrate-customers-from-firebase.js
```

## 🆘 Need Help?

If you run into issues:
1. Share the "Available collections" output
2. Let me know any error messages
3. I can customize the script for your specific setup