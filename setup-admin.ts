/**
 * Admin Setup Script
 * Run this once to create your admin account
 * 
 * Usage: pnpm tsx scripts/setup-admin.ts
 */

import * as readline from 'readline';
import { initializeAdmin } from '../server/auth';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  RV50X LWM2M Gateway Manager');
  console.log('  Admin Account Setup');
  console.log('========================================\n');

  try {
    // Get username
    let username = '';
    while (!username) {
      username = await question('Enter admin username: ');
      if (!username) {
        console.log('Username cannot be empty.\n');
      }
    }

    // Get password
    let password = '';
    while (!password) {
      password = await question('Enter admin password: ');
      if (!password) {
        console.log('Password cannot be empty.\n');
      }
      if (password.length < 8) {
        console.log('Password must be at least 8 characters.\n');
        password = '';
      }
    }

    // Confirm password
    let passwordConfirm = '';
    while (passwordConfirm !== password) {
      passwordConfirm = await question('Confirm admin password: ');
      if (passwordConfirm !== password) {
        console.log('Passwords do not match. Please try again.\n');
        passwordConfirm = '';
      }
    }

    // Get email (optional)
    const email = await question('Enter admin email (optional, for password recovery): ');

    console.log('\nCreating admin account...\n');

    const success = await initializeAdmin(username, password, email || undefined);

    if (success) {
      console.log('✅ Admin account created successfully!\n');
      console.log('========================================');
      console.log('  Setup Complete');
      console.log('========================================');
      console.log(`Username: ${username}`);
      console.log(`Email: ${email || '(not set)'}`);
      console.log('\nYou can now login to the application.');
      console.log('Start the server with: pnpm dev\n');
    } else {
      console.log('❌ Failed to create admin account.');
      console.log('Admin account may already exist.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

