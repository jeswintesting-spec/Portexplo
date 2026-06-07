const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });
  const page = await browser.newPage();
  
  // Set local storage to skip welcome screen
  await page.goto('http://localhost:5050');
  await page.evaluate(() => {
    localStorage.setItem('portexplo_welcome_dismissed', 'true');
  });

  // Screenshot 1: Welcome / Role Selection Screen
  console.log('Navigating to workspace selection...');
  await page.goto('http://localhost:5050', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshot-welcome.png' });
  console.log('Captured screenshot-welcome.png');

  // Navigate to explorer
  console.log('Clicking Explorer role...');
  await page.evaluate(() => {
    const explorerCard = document.querySelector('.welcome-role-card');
    if (explorerCard) explorerCard.click();
  });
  await new Promise(r => setTimeout(r, 1000)); // Wait for transition
  
  // Screenshot 2: File Explorer Dashboard
  console.log('Captured screenshot-explorer.png');
  await page.screenshot({ path: 'screenshot-explorer.png' });

  // Open User Manual for a cool shot
  console.log('Opening User Manual...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const manualBtn = btns.find(b => b.innerText.includes('Manual'));
    if (manualBtn) manualBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000)); // Wait for modal
  
  // Screenshot 3: User Manual Modal
  console.log('Captured screenshot-manual.png');
  await page.screenshot({ path: 'screenshot-manual.png' });

  await browser.close();
  console.log('Done!');
})();
