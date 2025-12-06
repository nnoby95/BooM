# Deploy TW Controller to Linode

## Prerequisites
- Linode server created with Ubuntu 22.04
- Root SSH access to Linode server
- Linode public IP address (example: 172.105.x.x)

## Step 1: Connect to Linode via SSH

From your local PC:
```bash
ssh root@YOUR_LINODE_IP
```

## Step 2: Install Node.js on Linode

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

## Step 3: Upload Server Files to Linode

From your LOCAL PC (in d:\TW\Multy):

### Option A: Using SCP (Simple)
```bash
# Create directory on Linode first
ssh root@YOUR_LINODE_IP "mkdir -p /root/tw-controller"

# Upload server directory
scp -r d:\TW\Multy\server\* root@YOUR_LINODE_IP:/root/tw-controller/
```

### Option B: Using Git (Recommended)
```bash
# On Linode server
cd /root
git init tw-controller
cd tw-controller

# Then copy files manually or use git
```

### Option C: Manual Copy (Easiest)
1. ZIP the d:\TW\Multy\server folder on your PC
2. Upload via Linode's file manager or WinSCP
3. Extract on the server

## Step 4: Install Dependencies and Start Server

On Linode:
```bash
cd /root/tw-controller
npm install
npm start
```

Server should start on https://YOUR_LINODE_IP:3000

## Step 5: Keep Server Running (Use PM2)

Install PM2 to keep server running after you disconnect:
```bash
npm install -g pm2
pm2 start index.js --name tw-controller
pm2 save
pm2 startup  # Follow the instructions it gives you
```

## Step 6: Test Connectivity

From your browser:
```
https://YOUR_LINODE_IP:3000
```

You'll get a certificate warning (self-signed cert) - click "Advanced" and "Proceed".

## Step 7: Update Userscript

Update the serverUrl in tw-agent.user.js:
```javascript
serverUrl: 'wss://YOUR_LINODE_IP:3000/ws'
```

Add @connect directive:
```
// @connect YOUR_LINODE_IP
```

## Firewall Configuration (if needed)

If the server is not accessible, open port 3000:
```bash
ufw allow 3000/tcp
ufw status
```

## Optional: Get Free SSL Certificate (Let's Encrypt)

For proper SSL certificate instead of self-signed:
1. Point a domain to your Linode IP
2. Use certbot to get Let's Encrypt certificate
3. Update server to use new certificates

This is optional - self-signed works fine for this use case.
