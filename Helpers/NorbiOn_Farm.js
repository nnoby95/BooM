
/*
 * Norbi0N Farm Engine
 * Clean Architecture: Engine Tab -> Farm Tab -> Script Injection -> Enter Simulation
 * NO EMOJIS - Clean Code Only
 */

// =============================================================================
// MAIN ENGINE - PERSISTENT TAB
// =============================================================================

const NorbiFarmEngine = {
    isRunning: false,
    farmTab: null,
    loopEnabled: false,
    loopTimer: null,
    botDetectionTimer: null,
    settings: {
        loopInterval: 10, // minutes
        randomDelayRange: 3, // ±X minutes
        discordWebhookUrl: '', // Discord webhook URL
        telegramBotToken: '', // Telegram bot token
        telegramChatId: '', // Telegram chat ID
        notificationsEnabled: true // Enable/disable notifications
    },
    
    init: function() {
        this.createUI();
        this.setupMessageListener();
        this.renameTab();
        this.startBotDetection(); // Start continuous bot detection
        console.log('Norbi0N Farm Engine initialized');
    },
    
    renameTab: function() {
        // Change the browser tab title to identify the engine tab
        document.title = 'Norbi0n - ' + document.title;
        console.log('Tab renamed to: ' + document.title);
    },
    
    createUI: function() {
        var engineHTML = '<div id="norbi-farm-engine" style="' +
            'position: fixed;' +
            'top: 10px;' +
            'right: 10px;' +
            'width: 450px;' +
            'background: #f4e4bc;' +
            'border: 3px outset #7d510f;' +
            'border-radius: 8px;' +
            'padding: 0;' +
            'z-index: 9999;' +
            'font-family: Verdana, Arial, sans-serif;' +
            'font-size: 11px;' +
            'box-shadow: 3px 3px 8px rgba(0,0,0,0.4);' +
        '">' +
            // Header
            '<div style="' +
                'background: linear-gradient(to bottom, #c1a264, #a08751);' +
                'padding: 12px;' +
                'border-bottom: 2px solid #603000;' +
                'font-weight: bold;' +
                'text-align: center;' +
                'font-size: 14px;' +
                'color: #2c1810;' +
                'text-shadow: 1px 1px 1px rgba(255,255,255,0.3);' +
                'border-radius: 5px 5px 0 0;' +
            '">' +
                'Norbi0N Farm Engine v2.0 [ENGINE TAB]' +
            '</div>' +
            
            '<div style="padding: 15px;">' +
                // Status Section
                '<table class="vis" style="width: 100%; margin-bottom: 15px;">' +
                    '<tr><th colspan="2" style="background: #c1a264; text-align: center;">Status</th></tr>' +
                    '<tr><td style="width: 30%; font-weight: bold;">Engine:</td><td><span id="engine-status" style="font-weight: bold; color: #2c7d32;">Ready</span></td></tr>' +
                    '<tr><td style="font-weight: bold;">Village:</td><td><span style="color: #1976d2;">' + game_data.village.id + '</span></td></tr>' +
                    '<tr><td style="font-weight: bold;">Loop Mode:</td><td><span id="loop-status" style="font-weight: bold; color: #d32f2f;">Disabled</span></td></tr>' +
                '</table>' +
                
                // Settings Panel
                '<table class="vis" style="width: 100%; margin-bottom: 15px;">' +
                    '<tr><th colspan="2" style="background: #c1a264; text-align: center;">Settings</th></tr>' +
                    '<tr>' +
                        '<td style="width: 35%; font-weight: bold; vertical-align: middle;">Loop Interval:</td>' +
                        '<td>' +
                            '<input id="loop-interval" type="number" min="1" max="999" value="10" style="width: 70px; padding: 4px; border: 1px solid #603000; font-family: Verdana, Arial; font-size: 11px; text-align: center;"> minutes' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Random Delay:</td>' +
                        '<td>' +
                            '<span style="font-size: 11px;">±</span> <input id="random-delay" type="number" min="0" max="99" value="3" style="width: 50px; padding: 4px; border: 1px solid #603000; font-family: Verdana, Arial; font-size: 11px; text-align: center;"> minutes' +
                            '<div style="font-size: 9px; color: #666; margin-top: 2px;">Random delay from -X to +X minutes</div>' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Loop Mode:</td>' +
                        '<td>' +
                            '<label style="display: flex; align-items: center; font-weight: bold;">' +
                                '<input type="checkbox" id="enable-loop" style="margin-right: 8px;"> Enable Loop Mode' +
                            '</label>' +
                        '</td>' +
                    '</tr>' +
                '</table>' +
                
                // Notifications Panel
                '<table class="vis" style="width: 100%; margin-bottom: 15px;">' +
                    '<tr><th colspan="2" style="background: #c1a264; text-align: center;">Bot Protection Alerts</th></tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Notifications:</td>' +
                        '<td>' +
                            '<label style="display: flex; align-items: center; font-weight: bold;">' +
                                '<input type="checkbox" id="enable-notifications" style="margin-right: 8px;"> Enable Notifications' +
                            '</label>' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Discord Webhook:</td>' +
                        '<td>' +
                            '<input id="discord-webhook" type="text" placeholder="https://discord.com/api/webhooks/..." style="width: 100%; padding: 4px; border: 1px solid #603000; font-family: Verdana, Arial; font-size: 10px;">' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Telegram Token:</td>' +
                        '<td>' +
                            '<input id="telegram-token" type="text" placeholder="123456:ABC-DEF1234..." style="width: 100%; padding: 4px; border: 1px solid #603000; font-family: Verdana, Arial; font-size: 10px;">' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Telegram Chat ID:</td>' +
                        '<td>' +
                            '<input id="telegram-chat-id" type="text" placeholder="123456789 or @username" style="width: 100%; padding: 4px; border: 1px solid #603000; font-family: Verdana, Arial; font-size: 10px;">' +
                            '<div style="font-size: 9px; color: #666; margin-top: 2px;">Will send 15 aggressive notifications!</div>' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<td style="font-weight: bold; vertical-align: middle;">Test Notifications:</td>' +
                        '<td>' +
                            '<div style="display: flex; gap: 4px; margin-top: 4px;">' +
                                '<input id="test-discord-btn" class="btn btn-default" type="button" value="Test Discord" style="flex: 1; padding: 4px 8px; font-size: 10px !important;">' +
                                '<input id="test-telegram-btn" class="btn btn-default" type="button" value="Test Telegram" style="flex: 1; padding: 4px 8px; font-size: 10px !important;">' +
                            '</div>' +
                        '</td>' +
                    '</tr>' +
                '</table>' +
                
                // Control Buttons
                '<div style="margin-bottom: 15px;">' +
                    '<div style="display: flex; gap: 8px; margin-bottom: 8px;">' +
                        '<input id="start-farm-btn" class="btn btn-default" type="button" value="Start Farming" style="flex: 1; padding: 8px 12px; font-size: 11px !important;">' +
                        '<input id="stop-loop-btn" class="btn btn-default" type="button" value="Stop Loop" style="flex: 1; padding: 8px 12px; font-size: 11px !important; opacity: 0.5;" disabled>' +
                    '</div>' +
                    '<input id="save-settings-btn" class="btn btn-default" type="button" value="Save Settings" style="width: 100%; padding: 8px 12px; font-size: 11px !important;">' +
            '</div>' +
            
                // Log Section
                '<table class="vis" style="width: 100%;">' +
                    '<tr><th style="background: #c1a264; text-align: center;">Activity Log</th></tr>' +
                    '<tr><td style="padding: 0;">' +
                        '<div id="farm-log" style="' +
                            'padding: 8px; background: #ffffff; height: 150px; overflow-y: auto; font-size: 10px;' +
                            'border: 1px inset #ccc; margin: 4px; font-family: monospace;' +
                        '"></div>' +
                    '</td></tr>' +
                '</table>' +
            '</div>' +
        '</div>';
        
        // Remove existing engine if present
        var existing = document.getElementById('norbi-farm-engine');
        if (existing) existing.remove();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', engineHTML);
        
        // Load saved settings
        this.loadSettings();
        
        // Bind events
        var self = this;
        document.getElementById('start-farm-btn').addEventListener('click', function() {
            self.startFarming();
        });
        
        document.getElementById('stop-loop-btn').addEventListener('click', function() {
            self.stopLoop();
        });
        
        document.getElementById('save-settings-btn').addEventListener('click', function() {
            self.saveSettings();
        });
        
        document.getElementById('enable-loop').addEventListener('change', function() {
            self.updateLoopStatus();
        });
        
        // Test button event handlers
        document.getElementById('test-discord-btn').addEventListener('click', function() {
            self.testDiscordNotification();
        });
        
        document.getElementById('test-telegram-btn').addEventListener('click', function() {
            self.testTelegramNotification();
        });
        
        // Add input validation for number fields
        document.getElementById('loop-interval').addEventListener('input', function() {
            var value = parseInt(this.value);
            if (isNaN(value) || value < 1) {
                this.style.borderColor = '#ff0000';
            } else {
                this.style.borderColor = '#603000';
            }
        });
        
        document.getElementById('random-delay').addEventListener('input', function() {
            var value = parseInt(this.value);
            if (isNaN(value) || value < 0) {
                this.style.borderColor = '#ff0000';
            } else {
                this.style.borderColor = '#603000';
            }
        });
        
        // Update initial UI state
        this.updateLoopStatus();
    },
    
    startFarming: function() {
        if (this.isRunning) {
            this.log('Already running!');
            return;
        }
        
        this.isRunning = true;
        this.updateStatus('Opening farm tab...');
        this.log('Starting farm process');
        
        // Get current subdomain and build farm URL dynamically
        var currentHost = window.location.hostname; // Gets "hu93.klanhaboru.hu" or "huc3.klanhaboru.hu"
        var farmUrl = 'https://' + currentHost + '/game.php?village=' + game_data.village.id + '&screen=am_farm';
        
        this.log('Detected subdomain: ' + currentHost);
        this.log('Opening farm tab on same subdomain...');
        
        this.farmTab = window.open(farmUrl, '_blank');
        
        this.log('Opened farm tab: ' + farmUrl);
        
        // Inject our handler into the farm tab after it loads
        var self = this;
        setTimeout(function() {
            self.injectHandlerIntoFarmTab();
        }, 4000); // Wait 4 seconds for farm tab to load
        
        // Monitor tab status
        this.monitorFarmTab();
    },
    
    injectHandlerIntoFarmTab: function() {
        var self = this;
        
        try {
            if (this.farmTab && !this.farmTab.closed) {
                this.log('Injecting handler into farm tab...');
                
                // Inject our farm handler directly into the farm tab
                var handlerScript = `
                    console.log('Farm tab handler injected');
                    
                    function startFarmProcess() {
                        console.log('Starting farm process in farm tab...');
                        
                        // Step 1: Wait a moment
                        setTimeout(function() {
                            console.log('Checking jQuery availability...');
                            console.log('window.$ available:', typeof window.$);
                            
                            if (typeof window.$ !== 'undefined' && window.$.getScript) {
                                console.log('Loading FarmGod script...');
                                
                                // Load FarmGod script
                                window.$.getScript('https://media.innogamescdn.com/com_DS_HU/scripts/farmgod.js')
                                    .done(function() {
                                        console.log('FarmGod script loaded!');
                                        
                                        // Wait for FarmGod to initialize
                                        setTimeout(function() {
                                            if (typeof window.FarmGod !== 'undefined') {
                                                console.log('FarmGod ready, starting Final Initialization...');
                                                
                                                // Step 2: Final Initialization - Click the "Farm megtervezése" button
                                                var planButton = document.querySelector('input.btn.optionButton[value="Farm megtervezése"]');
                                                if (planButton) {
                                                    console.log('Found Farm megtervezése button, clicking...');
                                                    planButton.click();

                                                    // Wait for loading throbber to disappear before starting farming
                                                    console.log('Waiting for loading throbber to disappear...');

                                                    function waitForThrobberToDisappear(callback) {
                                                        var checkInterval = setInterval(function() {
                                                            var throbber = document.querySelector('img[src="/graphic/throbber.gif"]');

                                                            if (!throbber) {
                                                                console.log('Throbber disappeared, loading complete!');
                                                                clearInterval(checkInterval);
                                                                callback();
                                                            } else {
                                                                console.log('Still loading... (throbber visible)');
                                                            }
                                                        }, 500); // Check every 500ms

                                                        // Timeout after 30 seconds
                                                        setTimeout(function() {
                                                            clearInterval(checkInterval);
                                                            console.log('Throbber wait timeout, continuing anyway...');
                                                            callback();
                                                        }, 30000);
                                                    }

                                                    // Wait for throbber to disappear, then start farming
                                                    waitForThrobberToDisappear(function() {
                                                        console.log('Farm plan created, now starting continuous farming...');
                                                        
                                                        // Start the continuous farming process with button clicking
                                                        var farmHandler = {
                                                            farmTimer: null,
                                                            totalClicks: 0,
                                                            isRunning: false,
                                                            isPaused: false,
                                                            startTime: null,
                                                            recheckTimeout: null,

                                                            startFarming: function() {
                                                                console.log('Starting continuous farming with button clicking...');
                                                                this.isRunning = true;
                                                                this.isPaused = false;
                                                                this.totalClicks = 0;
                                                                this.startTime = Date.now();
                                                                var self = this;

                                                                // Start single interval: bot check -> progress check -> button click
                                                                this.farmTimer = setInterval(function() {
                                                                    // Skip if paused (waiting for bot protection recheck)
                                                                    if (self.isPaused) {
                                                                        return;
                                                                    }

                                                                    // Step 1: Check bot protection first
                                                                    if (self.checkBotProtection()) {
                                                                        return; // Paused, waiting for recheck
                                                                    }

                                                                    // Step 2: Check progress
                                                                    if (self.monitorProgress()) {
                                                                        return; // Stop if farming completed
                                                                    }

                                                                    // Step 3: Click farm button
                                                                    self.clickFarmButton();
                                                                }, 220); // Check and click every 220ms
                                                            },
                                                            
                                                            clickFarmButton: function() {
                                                                if (!this.isRunning) return;

                                                                try {
                                                                    // Look for farm buttons (A or B)
                                                                    var buttonA = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_a');
                                                                    var buttonB = document.querySelector('a.farmGod_icon.farm_icon.farm_icon_b');

                                                                    // Click whichever button is available
                                                                    var button = buttonA || buttonB;

                                                                    if (button) {
                                                                        button.click();
                                                                        this.totalClicks++;

                                                                        if (this.totalClicks % 50 === 0) {
                                                                            console.log('Clicked farm button ' + this.totalClicks + ' times');
                                                                        }
                                                                    } else {
                                                                        // No button found - just wait for next cycle
                                                                        if (this.totalClicks % 50 === 0) {
                                                                            console.log('No farm button found, waiting...');
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error clicking farm button:', error);
                                                                }
                                                            },
                                                            
                                                            monitorProgress: function() {
                                                                if (!this.isRunning) return false;
                                                                
                                                                try {
                                                                    var progressBar = document.getElementById('FarmGodProgessbar');
                                                                    if (!progressBar) return false;
                                                                    
                                                                    var labelSpan = progressBar.querySelector('span.label');
                                                                    if (!labelSpan) return false;
                                                                    
                                                                    var progressText = labelSpan.textContent.trim();
                                                                    
                                                                    console.log('Raw progress text: "' + progressText + '"');
                                                                    
                                                                    // Get clean text (handles HTML like grey dots)
                                                                    var cleanText = labelSpan.innerText || labelSpan.textContent;
                                                                    console.log('Clean text: "' + cleanText + '"');
                                                                    
                                                                    // Simple string-based parsing to avoid regex escaping issues
                                                                    var originalTotal = null;
                                                                    var match = null;
                                                                    
                                                                    // Split by " / " to get parts
                                                                    var parts = cleanText.split(' / ');
                                                                    console.log('Split parts:', parts);
                                                                    
                                                                    if (parts.length === 2) {
                                                                        var currentStr = parts[0].trim();
                                                                        var totalStr = parts[1].trim();
                                                                        
                                                                        // Handle thousands separators in BOTH current and total
                                                                        if (currentStr.indexOf('.') !== -1) {
                                                                            console.log('Current thousands separator detected: ' + currentStr + ' -> ' + currentStr.replace('.', ''));
                                                                            currentStr = currentStr.replace('.', ''); // "1.552" -> "1552"
                                                                        }
                                                                        
                                                                        if (totalStr.indexOf('.') !== -1) {
                                                                            console.log('Total thousands separator detected: ' + totalStr + ' -> ' + totalStr.replace('.', ''));
                                                                            originalTotal = parseFloat(totalStr); // Keep original for reporting
                                                                            totalStr = totalStr.replace('.', ''); // Remove thousands separator: "1.552" -> "1552"
                                                                        }
                                                                        
                                                                        // Create fake match array for compatibility
                                                                        match = [cleanText, currentStr, totalStr];
                                                                    }
                                                                    
                                                                    if (!match) {
                                                                        console.log('FarmGod Progress: Could not parse format "' + progressText + '"');
                                                                        return false;
                                                                    }
                                                                    
                                                                    var current = parseInt(match[1]);
                                                                    var total = parseInt(match[2]);
                                                                    var percentage = total > 0 ? (current / total) * 100 : 0;
                                                                    
                                                                    // Debug logging for different formats
                                                                    if (cleanText.indexOf('.') !== -1) {
                                                                        console.log('FarmGod Progress: Decimal format detected "' + cleanText + '" -> ' + current + '/' + total + ' (rounded up)');
                                                                    }
                                                                    
                                                                    console.log('Progress: ' + cleanText + ' (' + percentage.toFixed(1) + '%)');
                                                                    console.log('Completion check: ' + current + ' >= ' + total + ' = ' + (current >= total));
                                                                    
                                                                    // Check if farming is complete
                                                                    if (current >= total) {
                                                                        console.log('FARMING COMPLETED! Final: ' + cleanText);
                                                                        this.stopFarming();

                                                                        // Calculate farming duration
                                                                        var endTime = Date.now();
                                                                        var durationMs = endTime - this.startTime;
                                                                        var durationMinutes = Math.floor(durationMs / 60000);
                                                                        var durationSeconds = Math.floor((durationMs % 60000) / 1000);

                                                                        console.log('Farming took: ' + durationMinutes + ' minutes ' + durationSeconds + ' seconds');
                                                                        console.log('Total villages farmed: ' + current);
                                                                        console.log('Total button clicks: ' + this.totalClicks);

                                                                        // Use original decimal value for reporting if available
                                                                        var reportedVillages = originalTotal !== null ? originalTotal : current;
                                                                        console.log('Reported villages: ' + reportedVillages);

                                                                        // Report success with detailed results
                                                        localStorage.setItem('norbi_farm_result', JSON.stringify({
                                                            status: 'success',
                                                                        message: 'Farming completed successfully',
                                                                        villages: reportedVillages,
                                                                        totalClicks: this.totalClicks,
                                                                            finalProgress: cleanText,
                                                                        timeMinutes: durationMinutes,
                                                                        timeSeconds: durationSeconds,
                                                            timestamp: Date.now()
                                                        }));

                                                                        // Close tab after 3 seconds
                                                                        setTimeout(function() {
                                                                            console.log('Closing farm tab...');
                                                                            window.close();
                                                                        }, 3000);

                                                                        return true; // Farming completed
                                                                    }

                                                                    return false; // Not complete yet
                                                                } catch (error) {
                                                                    console.error('Error monitoring progress:', error);
                                                                }
                                                            },
                                                            
                                                            detectBotProtection: function() {
                                                                // Comprehensive bot protection detection
                                                                try {
                                                                    // Method 1: Check for botprotection_quest element
                                                                    var botElement = document.getElementById('botprotection_quest');
                                                                    if (botElement) {
                                                                        return 'botprotection_quest element';
                                                                    }

                                                                    // Method 2: Check for .bot-protection-row
                                                                    var botProtectionRow = document.querySelector('.bot-protection-row');
                                                                    if (botProtectionRow) {
                                                                        return '.bot-protection-row element';
                                                                    }

                                                                    // Method 3: Check for .captcha element
                                                                    var captchaElement = document.querySelector('.captcha');
                                                                    if (captchaElement) {
                                                                        return '.captcha element';
                                                                    }

                                                                    // Method 4-7: Check for bot protection text
                                                                    var bodyText = document.body.textContent || document.body.innerText || '';
                                                                    if (bodyText.indexOf('Bot védelem') !== -1) {
                                                                        return '"Bot védelem" text';
                                                                    }
                                                                    if (bodyText.indexOf('Kezdd meg a botvédelem ellenőrzését') !== -1) {
                                                                        return '"Kezdd meg a botvédelem ellenőrzését" text';
                                                                    }
                                                                    if (bodyText.indexOf('botvédelem ellenőrzését') !== -1) {
                                                                        return '"botvédelem ellenőrzését" text';
                                                                    }
                                                                    if (bodyText.indexOf('Start the bot protection check') !== -1) {
                                                                        return '"Start the bot protection check" text';
                                                                    }

                                                                } catch (error) {
                                                                    console.error('Error in detectBotProtection:', error);
                                                                }

                                                                return null; // No bot protection detected
                                                            },

                                                            checkBotProtection: function() {
                                                                if (!this.isRunning) return false;

                                                                var detectionMethod = this.detectBotProtection();

                                                                if (detectionMethod) {
                                                                    // Bot protection detected!
                                                                    if (!this.isPaused) {
                                                                        // First detection - pause and schedule recheck
                                                                        console.log('BOT PROTECTION DETECTED! Method: ' + detectionMethod);
                                                                        console.log('Pausing farming for 10 seconds... (captcha solver working)');

                                                                        this.isPaused = true;
                                                                        var self = this;

                                                                        // Schedule recheck after 10 seconds
                                                                        this.recheckTimeout = setTimeout(function() {
                                                                            console.log('Rechecking bot protection after 10 seconds...');

                                                                            var recheckMethod = self.detectBotProtection();

                                                                            if (recheckMethod) {
                                                                                // Still detected - stop farming completely
                                                                                console.log('BOT PROTECTION STILL PRESENT! Method: ' + recheckMethod);
                                                                                console.log('Captcha solver failed or timeout. Stopping farming...');

                                                                                self.stopFarming();

                                                                                // Report bot protection detection
                                                                                localStorage.setItem('norbi_farm_result', JSON.stringify({
                                                                                    status: 'error',
                                                                                    message: 'Bot protection detected - farming stopped after recheck',
                                                                                    error: 'Bot protection still present after 10 seconds',
                                                                                    detectionMethod: recheckMethod,
                                                                                    totalClicks: self.totalClicks,
                                                                                    timestamp: Date.now()
                                                                                }));
                                                                            } else {
                                                                                // All clear - resume farming!
                                                                                console.log('BOT PROTECTION CLEARED! Captcha solver successful!');
                                                                                console.log('Resuming farming...');
                                                                                self.isPaused = false;
                                                                            }
                                                                        }, 10000); // 10 seconds
                                                                    }

                                                                    return true; // Bot protection detected (paused)
                                                                }

                                                                return false; // No bot protection
                                                            },
                                                            
                                                            stopFarming: function() {
                                                                this.isRunning = false;
                                                                this.isPaused = false;

                                                                // Clear farm timer
                                                                if (this.farmTimer) {
                                                                    clearInterval(this.farmTimer);
                                                                    this.farmTimer = null;
                                                                }

                                                                // Clear recheck timeout if exists
                                                                if (this.recheckTimeout) {
                                                                    clearTimeout(this.recheckTimeout);
                                                                    this.recheckTimeout = null;
                                                                }

                                                                console.log('Stopped farming. Total button clicks: ' + this.totalClicks);
                                                            }
                                                        };
                                                        
                                                        // Start the farming process
                                                        farmHandler.startFarming();
                                                    }); // End of waitForThrobberToDisappear callback

                                                } else {
                                                    console.error('Farm megtervezése button not found');
                                                    localStorage.setItem('norbi_farm_result', JSON.stringify({
                                                        status: 'error',
                                                        message: 'Farm megtervezése button not found',
                                                        timestamp: Date.now()
                                                    }));
                                                }
                                                
                                            } else {
                                                console.error('FarmGod not loaded');
                                                localStorage.setItem('norbi_farm_result', JSON.stringify({
                                                    status: 'error',
                                                    message: 'FarmGod failed to load',
                                                    timestamp: Date.now()
                                                }));
                                            }
                                        }, 2000);
                                    })
                                    .fail(function() {
                                        console.error('Failed to load FarmGod script');
                                        localStorage.setItem('norbi_farm_result', JSON.stringify({
                                            status: 'error',
                                            message: 'Failed to load FarmGod script',
                                            timestamp: Date.now()
                                        }));
                                    });
                            } else {
                                console.error('jQuery not available in farm tab');
                                localStorage.setItem('norbi_farm_result', JSON.stringify({
                                    status: 'error',
                                    message: 'jQuery not available',
                                    timestamp: Date.now()
                                }));
                            }
                        }, 1000);
                    }
                    
                    // Start the process
                    startFarmProcess();
                `;
                
                // Execute the handler in the farm tab
                this.farmTab.eval(handlerScript);
                this.log('Handler injected and executed');
                
            } else {
                this.log('Farm tab not available for injection');
            }
        } catch (error) {
            console.error('Failed to inject handler:', error);
            this.log('Failed to inject handler: ' + error.message);
        }
    },
    
    monitorFarmTab: function() {
        var self = this;
        var checkInterval = setInterval(function() {
            // Check if tab was closed manually
            if (self.farmTab && self.farmTab.closed) {
                clearInterval(checkInterval);
                self.resetEngine();
                self.log('Farm tab was closed manually');
                return;
            }
            
            // Check for completion message
            var result = localStorage.getItem('norbi_farm_result');
            if (result) {
                clearInterval(checkInterval);
                var data = JSON.parse(result);
                self.handleFarmResult(data);
                localStorage.removeItem('norbi_farm_result');
            }
        }, 1000);
        
        // Timeout after 5 minutes
        setTimeout(function() {
            clearInterval(checkInterval);
            if (self.isRunning) {
                self.log('Farm process timed out');
                self.resetEngine();
            }
        }, 5 * 60 * 1000);
    },
    
    handleFarmResult: function(data) {
        if (data.status === 'success') {
            if (data.villages && data.timeMinutes !== undefined) {
                // Enhanced success message with farming details
                var timeMsg = data.timeMinutes > 0 ? 
                    data.timeMinutes + ' minutes ' + data.timeSeconds + ' seconds' :
                    data.timeSeconds + ' seconds';
                    
                // Get current time for "minutes ago" format
                var now = new Date();
                var completionTime = now.toLocaleTimeString();
                    
                this.log('=== FARMING COMPLETED SUCCESSFULLY ===');
                this.log('Villages farmed: ' + data.villages + ' villages');
                this.log('Total farming time: ' + timeMsg);
                this.log('Button clicks: ' + (data.totalClicks || data.totalPresses || 'N/A'));
                this.log('Completed at: ' + completionTime);
                this.log('Final progress: ' + data.finalProgress);
                this.log('Farm tab will auto-close in 3 seconds...');
                this.updateStatus('Completed: ' + data.villages + ' villages in ' + timeMsg);
            } else {
                // Simple success message
                this.log('Farm completed: ' + data.message);
                this.updateStatus('Farm completed successfully');
            }
        } else {
            // Handle bot protection detection specially
            if (data.error === 'Bot protection quest appeared') {
                this.log('=== BOT PROTECTION DETECTED ===');
                this.log('Farming stopped immediately for safety!');
                this.log('Total clicks before stop: ' + (data.totalClicks || data.totalPresses || 'N/A'));
                this.log('Please solve the bot protection manually');
                this.updateStatus('Bot Protection Detected - Stopped');
        } else {
            this.log('Farm failed: ' + data.message);
            this.updateStatus('Farm failed: ' + data.error);
            }
        }
        
        this.resetEngine();
    },
    
    resetEngine: function() {
        this.isRunning = false;
        this.farmTab = null;
        this.updateStatus('Ready');
        
        // Clean up localStorage
        localStorage.removeItem('norbi_farm_command');
        localStorage.removeItem('norbi_farm_result');
        
        // If loop is enabled, schedule next run
        if (this.loopEnabled) {
            this.scheduleNextRun();
        }
    },
    
    // Settings Management
    loadSettings: function() {
        try {
            var saved = localStorage.getItem('norbi_farm_settings');
            if (saved) {
                var settings = JSON.parse(saved);
                this.settings = Object.assign(this.settings, settings);
                
                // Apply to UI
                document.getElementById('loop-interval').value = this.settings.loopInterval;
                document.getElementById('random-delay').value = this.settings.randomDelayRange;
                document.getElementById('enable-loop').checked = this.loopEnabled;
                document.getElementById('enable-notifications').checked = this.settings.notificationsEnabled;
                document.getElementById('discord-webhook').value = this.settings.discordWebhookUrl;
                document.getElementById('telegram-token').value = this.settings.telegramBotToken;
                document.getElementById('telegram-chat-id').value = this.settings.telegramChatId;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    },
    
    saveSettings: function() {
        try {
            // Get values from UI
            this.settings.loopInterval = parseInt(document.getElementById('loop-interval').value);
            this.settings.randomDelayRange = parseInt(document.getElementById('random-delay').value);
            this.settings.notificationsEnabled = document.getElementById('enable-notifications').checked;
            this.settings.discordWebhookUrl = document.getElementById('discord-webhook').value.trim();
            this.settings.telegramBotToken = document.getElementById('telegram-token').value.trim();
            this.settings.telegramChatId = document.getElementById('telegram-chat-id').value.trim();
            
            // Validate input values
            if (isNaN(this.settings.loopInterval) || this.settings.loopInterval < 1) {
                this.settings.loopInterval = 10;
                document.getElementById('loop-interval').value = 10;
            }
            
            if (isNaN(this.settings.randomDelayRange) || this.settings.randomDelayRange < 0) {
                this.settings.randomDelayRange = 3;
                document.getElementById('random-delay').value = 3;
            }
            
            this.loopEnabled = document.getElementById('enable-loop').checked;
            
            // Save to localStorage
            var settingsData = Object.assign({}, this.settings, { loopEnabled: this.loopEnabled });
            localStorage.setItem('norbi_farm_settings', JSON.stringify(settingsData));
            
            this.log('Settings saved successfully');
            this.log('Loop Interval: ' + this.settings.loopInterval + ' minutes');
            this.log('Random Delay: ±' + this.settings.randomDelayRange + ' minutes (range: ' + 
                (this.settings.loopInterval - this.settings.randomDelayRange) + '-' + 
                (this.settings.loopInterval + this.settings.randomDelayRange) + ' min)');
            this.log('Loop Mode: ' + (this.loopEnabled ? 'Enabled' : 'Disabled'));
            this.log('Notifications: ' + (this.settings.notificationsEnabled ? 'Enabled' : 'Disabled'));
            this.log('Discord Webhook: ' + (this.settings.discordWebhookUrl ? 'Configured' : 'Not configured'));
            this.log('Telegram Bot: ' + (this.settings.telegramBotToken && this.settings.telegramChatId ? 'Configured' : 'Not configured'));
            
            this.updateLoopStatus();
            
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.log('Failed to save settings');
        }
    },
    
    updateLoopStatus: function() {
        var loopStatusEl = document.getElementById('loop-status');
        var stopLoopBtn = document.getElementById('stop-loop-btn');
        
        if (this.loopEnabled) {
            loopStatusEl.textContent = 'Enabled';
            loopStatusEl.style.color = '#2c7d32';
            stopLoopBtn.disabled = false;
            stopLoopBtn.style.opacity = '1';
        } else {
            loopStatusEl.textContent = 'Disabled';
            loopStatusEl.style.color = '#d32f2f';
            stopLoopBtn.disabled = true;
            stopLoopBtn.style.opacity = '0.5';
        }
    },
    
    // Bot Protection Detection
    startBotDetection: function() {
        if (this.botDetectionTimer) return; // Already running
        
        var self = this;
        this.botDetectionTimer = setInterval(function() {
            self.checkBotProtection();
        }, 1000); // Check every 1 second
        
        this.log('Bot protection monitoring started');
    },
    
    stopBotDetection: function() {
        if (this.botDetectionTimer) {
            clearInterval(this.botDetectionTimer);
            this.botDetectionTimer = null;
            this.log('Bot protection monitoring stopped');
        }
    },
    
    checkBotProtection: function() {
        try {
            // Comprehensive bot protection detection
            var detectionMethods = [];

            // Method 1: Check for botprotection_quest element
            var botElement = document.getElementById('botprotection_quest');
            if (botElement) detectionMethods.push('botprotection_quest');

            // Method 2: Check for .bot-protection-row
            var botProtectionRow = document.querySelector('.bot-protection-row');
            if (botProtectionRow) detectionMethods.push('.bot-protection-row');

            // Method 3: Check for .captcha element
            var captchaElement = document.querySelector('.captcha');
            if (captchaElement) detectionMethods.push('.captcha');

            // Method 4-7: Check for bot protection text
            var bodyText = document.body.textContent || document.body.innerText || '';
            if (bodyText.indexOf('Bot védelem') !== -1) detectionMethods.push('"Bot védelem" text');
            if (bodyText.indexOf('Kezdd meg a botvédelem ellenőrzését') !== -1) detectionMethods.push('"Kezdd meg a botvédelem ellenőrzését"');
            if (bodyText.indexOf('botvédelem ellenőrzését') !== -1) detectionMethods.push('"botvédelem ellenőrzését"');
            if (bodyText.indexOf('Start the bot protection check') !== -1) detectionMethods.push('"Start the bot protection check"');

            // Check if any bot protection is detected
            if (detectionMethods.length > 0) {
                var detectionMethod = detectionMethods.join(', ');

                this.log('=== BOT PROTECTION DETECTED ===');
                this.log('Detection method(s): ' + detectionMethod);
                
                // Send notifications immediately
                var notificationMessage = this.loopEnabled ? 
                    'Bot protection detected! Loop mode stopped for safety' :
                    'Bot protection detected on page (loop mode already disabled)';
                
                var notificationsSent = [];
                
                // Try Discord notification
                this.sendDiscordNotification(notificationMessage, detectionMethod.trim());
                if (this.settings.notificationsEnabled && this.settings.discordWebhookUrl) {
                    notificationsSent.push('Discord');
                }
                
                // Try Telegram notification
                this.sendTelegramNotification(notificationMessage, detectionMethod.trim());
                if (this.settings.notificationsEnabled && this.settings.telegramBotToken && this.settings.telegramChatId) {
                    notificationsSent.push('Telegram');
                }
                
                // Log which notifications were sent
                if (notificationsSent.length > 0) {
                    this.log('🔔 Notifications sent via: ' + notificationsSent.join(' and '));
                } else {
                    this.log('🔔 No notification channels configured or enabled');
                }
                
                if (this.loopEnabled) {
                    // Loop mode is ON - stop it for safety
                    this.log('Bot protection detected! Loop mode stopped for safety');
                    
                    // Immediately disable loop mode
                    this.loopEnabled = false;
                    
                    // Clear any scheduled runs
                    if (this.loopTimer) {
                        clearTimeout(this.loopTimer);
                        this.loopTimer = null;
                    }
                    
                    // Update UI
                    document.getElementById('enable-loop').checked = false;
                    this.updateLoopStatus();
                    this.updateStatus('Bot Protection Detected - Loop Stopped');
                    
                    // Save settings to persist the disabled state
                    this.saveSettings();
                    
                    this.log('Please solve bot protection manually and re-enable loop mode when safe');
                } else {
                    // Loop mode is OFF - just log the detection
                    this.log('Bot protection detected on page (loop mode already disabled)');
                }
            }
        } catch (error) {
            console.error('Error checking bot protection:', error);
        }
    },
    
    // Loop Management
    scheduleNextRun: function() {
        if (!this.loopEnabled) return;
        
        // Calculate random delay using ±X system
        var baseDelayMinutes = this.settings.loopInterval;
        var randomRange = this.settings.randomDelayRange;
        
        // Generate random delay from -X to +X minutes
        var randomDelayMinutes = (Math.random() * 2 - 1) * randomRange; // -randomRange to +randomRange
        var totalDelayMinutes = baseDelayMinutes + randomDelayMinutes;
        
        // Ensure minimum delay of 1 minute
        if (totalDelayMinutes < 1) {
            totalDelayMinutes = 1;
        }
        
        var totalDelay = totalDelayMinutes * 60000; // Convert to milliseconds
        var delayMinutes = Math.round(totalDelayMinutes);
        
        var randomOffsetText = randomDelayMinutes >= 0 ? '+' + randomDelayMinutes.toFixed(1) : randomDelayMinutes.toFixed(1);
        this.log('Next farming session: ' + baseDelayMinutes + 'min ' + randomOffsetText + 'min = ' + delayMinutes + ' minutes');
        this.updateStatus('Waiting ' + delayMinutes + ' min for next run');
        
        var self = this;
        this.loopTimer = setTimeout(function() {
            if (self.loopEnabled) {
                self.log('Starting scheduled farming session...');
                self.startFarming();
            }
        }, totalDelay);
    },
    
    stopLoop: function() {
        this.loopEnabled = false;
        
        // Clear any scheduled runs
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }
        
        // Update UI
        document.getElementById('enable-loop').checked = false;
        this.updateLoopStatus();
        this.updateStatus('Ready');
        
        this.log('Loop mode disabled - no more scheduled runs');
        this.saveSettings();
    },
    
    updateStatus: function(status) {
        var statusEl = document.getElementById('engine-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    },
    
    log: function(message) {
        var logEl = document.getElementById('farm-log');
        if (logEl) {
            var timestamp = new Date().toLocaleTimeString();
            logEl.innerHTML += '<div>[' + timestamp + '] ' + message + '</div>';
            logEl.scrollTop = logEl.scrollHeight;
        }
        console.log('[Norbi Farm] ' + message);
    },
    
    // Notification System
    sendDiscordNotification: function(message, detectionMethods) {
        if (!this.settings.notificationsEnabled) {
            console.log('Notifications disabled, skipping Discord notification');
            return;
        }
        if (!this.settings.discordWebhookUrl) {
            console.log('Discord webhook not configured, skipping Discord notification');
            return;
        }
        
        var embed = {
            title: "🚨 BOT PROTECTION DETECTED",
            description: message,
            color: 15158332, // Red color
            fields: [
                {
                    name: "🎯 Detection Methods",
                    value: detectionMethods,
                    inline: true
                },
                {
                    name: "🏰 Village",
                    value: game_data.village.id.toString(),
                    inline: true
                },
                {
                    name: "⏰ Time",
                    value: new Date().toLocaleString(),
                    inline: true
                }
            ],
            footer: {
                text: "Norbi0N Farm Engine v2.0"
            }
        };
        
        var payload = {
            embeds: [embed]
        };
        
        fetch(this.settings.discordWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(function(response) {
            if (response.ok) {
                console.log('Discord notification sent successfully');
            } else {
                console.error('Failed to send Discord notification:', response.status);
            }
        }).catch(function(error) {
            console.error('Discord notification error:', error);
        });
    },
    
    sendTelegramNotification: function(message, detectionMethods) {
        if (!this.settings.notificationsEnabled) {
            console.log('Notifications disabled, skipping Telegram notification');
            return;
        }
        if (!this.settings.telegramBotToken || !this.settings.telegramChatId) {
            console.log('Telegram not configured, skipping Telegram notification');
            return;
        }
        
        var telegramMessage = "🚨 *BOT PROTECTION DETECTED* 🚨\n\n" +
            "💥 " + message + "\n\n" +
            "🎯 *Detection:* " + detectionMethods + "\n" +
            "🏰 *Village:* " + game_data.village.id + "\n" +
            "⏰ *Time:* " + new Date().toLocaleString() + "\n\n" +
            "⚠️ Loop mode has been disabled for safety!";
        
        var url = 'https://api.telegram.org/bot' + this.settings.telegramBotToken + '/sendMessage';
        
        var payload = {
            chat_id: this.settings.telegramChatId,
            text: telegramMessage,
            parse_mode: 'Markdown'
        };
        
        // Send 15 aggressive notifications as requested
        for (var i = 1; i <= 15; i++) {
            (function(msgNumber) {
                setTimeout(function() {
                    var aggressivePayload = Object.assign({}, payload, {
                        text: "🚨 ALERT #" + msgNumber + "/15 🚨\n\n" + telegramMessage
                    });
                    
                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(aggressivePayload)
                    }).then(function(response) {
                        if (response.ok) {
                            console.log('Telegram notification #' + msgNumber + ' sent successfully');
                        } else {
                            console.error('Failed to send Telegram notification #' + msgNumber + ':', response.status);
                        }
                    }).catch(function(error) {
                        console.error('Telegram notification #' + msgNumber + ' error:', error);
                    });
                }, (msgNumber - 1) * 500); // 500ms delay between messages
            })(i);
        }
    },
    
    // Test Notification Functions
    testDiscordNotification: function() {
        var discordUrl = document.getElementById('discord-webhook').value.trim();
        var notificationsEnabled = document.getElementById('enable-notifications').checked;
        
        if (!notificationsEnabled) {
            this.log('⚠️ Notifications are disabled! Enable them first.');
            return;
        }
        
        if (!discordUrl) {
            this.log('⚠️ Discord webhook URL not configured!');
            return;
        }
        
        this.log('🧪 Sending Discord test notification...');
        
        var embed = {
            title: "🧪 DISCORD TEST NOTIFICATION",
            description: "This is a test notification from your Norbi0N Farm Engine!",
            color: 3447003, // Blue color for test
            fields: [
                {
                    name: "✅ Status",
                    value: "Test Successful",
                    inline: true
                },
                {
                    name: "🏰 Village",
                    value: game_data.village.id.toString(),
                    inline: true
                },
                {
                    name: "⏰ Time",
                    value: new Date().toLocaleString(),
                    inline: true
                }
            ],
            footer: {
                text: "Norbi0N Farm Engine v2.0 [TEST MODE]"
            }
        };
        
        var payload = {
            embeds: [embed]
        };
        
        var self = this;
        fetch(discordUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }).then(function(response) {
            if (response.ok) {
                self.log('✅ Discord test notification sent successfully!');
            } else {
                self.log('❌ Discord test failed: HTTP ' + response.status);
            }
        }).catch(function(error) {
            self.log('❌ Discord test error: ' + error.message);
        });
    },
    
    testTelegramNotification: function() {
        var telegramToken = document.getElementById('telegram-token').value.trim();
        var telegramChatId = document.getElementById('telegram-chat-id').value.trim();
        var notificationsEnabled = document.getElementById('enable-notifications').checked;
        
        if (!notificationsEnabled) {
            this.log('⚠️ Notifications are disabled! Enable them first.');
            return;
        }
        
        if (!telegramToken || !telegramChatId) {
            this.log('⚠️ Telegram token or chat ID not configured!');
            return;
        }
        
        this.log('🧪 Sending Telegram test notification (3 messages)...');
        
        var telegramMessage = "🧪 *TELEGRAM TEST NOTIFICATION* 🧪\n\n" +
            "✅ This is a test notification from your Norbi0N Farm Engine!\n\n" +
            "🏰 *Village:* " + game_data.village.id + "\n" +
            "⏰ *Time:* " + new Date().toLocaleString() + "\n\n" +
            "🔥 Test successful!";
        
        var url = 'https://api.telegram.org/bot' + telegramToken + '/sendMessage';
        
        var payload = {
            chat_id: telegramChatId,
            text: telegramMessage,
            parse_mode: 'Markdown'
        };
        
        var self = this;
        // Send 3 test messages instead of 15 for testing
        for (var i = 1; i <= 3; i++) {
            (function(msgNumber) {
                setTimeout(function() {
                    var testPayload = {
                        chat_id: telegramChatId,
                        text: "🧪 TEST MESSAGE #" + msgNumber + "/3 🧪\n\n" + telegramMessage,
                        parse_mode: 'Markdown'
                    };
                    
                    fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(testPayload)
                    }).then(function(response) {
                        if (response.ok) {
                            self.log('✅ Telegram test message #' + msgNumber + ' sent successfully!');
                        } else {
                            self.log('❌ Telegram test #' + msgNumber + ' failed: HTTP ' + response.status);
                        }
                    }).catch(function(error) {
                        self.log('❌ Telegram test #' + msgNumber + ' error: ' + error.message);
                    });
                }, (msgNumber - 1) * 1000); // 1 second delay between test messages
            })(i);
        }
    },
    
    setupMessageListener: function() {
        var self = this;
        // Listen for messages from farm tab
        window.addEventListener('message', function(event) {
            if (event.data && event.data.source === 'norbi_farm_tab') {
                self.log('Message from farm tab: ' + event.data.message);
            }
            
            // Listen for bot protection messages from farm tab
            if (event.data && event.data.source === 'norbi_farm_bot_detection') {
                self.log('=== BOT PROTECTION DETECTED IN FARM TAB ===');
                self.log('Message: ' + event.data.message);
                self.log('Detection method: ' + event.data.detectionMethod);
                self.log('Total presses: ' + event.data.totalPresses);
                
                // Send notifications via Discord and Telegram
                var notificationsSent = [];
                
                // Try Discord notification
                self.sendDiscordNotification(event.data.message, event.data.detectionMethod);
                if (self.settings.notificationsEnabled && self.settings.discordWebhookUrl) {
                    notificationsSent.push('Discord');
                }
                
                // Try Telegram notification
                self.sendTelegramNotification(event.data.message, event.data.detectionMethod);
                if (self.settings.notificationsEnabled && self.settings.telegramBotToken && self.settings.telegramChatId) {
                    notificationsSent.push('Telegram');
                }
                
                // Log which notifications were sent
                if (notificationsSent.length > 0) {
                    self.log('🔔 Farm tab notifications sent via: ' + notificationsSent.join(' and '));
                } else {
                    self.log('🔔 No notification channels configured for farm tab alerts');
                }
            }
        });
    }
};

// =============================================================================
// FARM TAB HANDLER - RUNS IN FARM TAB
// =============================================================================

const NorbiFarmTabHandler = {
    command: null,
    pressTimer: null,
    progressTimer: null,
    botDetectionTimer: null,
    totalPresses: 0,
    isRunning: false,
    
    init: function() {
        // Check if we're on the farm page
        if (window.location.href.indexOf('screen=am_farm') === -1) {
            return;
        }
        
        console.log('Farm tab handler initialized');
        
        // Check for farm command
        this.checkForCommand();
    },
    
    checkForCommand: function() {
        var commandData = localStorage.getItem('norbi_farm_command');
        if (!commandData) return;
        
        this.command = JSON.parse(commandData);
        
        if (this.command.action === 'start_farm') {
            console.log('Farm command received, starting process...');
            this.startFarmProcess();
        }
    },
    
    startFarmProcess: function() {
        var self = this;
        
        // Step 1: Wait 3 seconds after tab opens
        console.log('Waiting 3 seconds for tab to fully load...');
        setTimeout(function() {
            
            // Step 2: Wait for page to load completely
            self.waitForPageLoad(function() {
                
                // Step 3: Inject FarmGod script
                self.injectFarmGodScript(function() {
                    
                    // Step 4: Wait for FarmGod to initialize
                    self.waitForFarmGod(function() {
                        
                        // Step 5: Start continuous Enter pressing and progress monitoring
                        self.startContinuousFarming();
                    });
                });
            });
        }, 3000);
    },
    
    waitForPageLoad: function(callback) {
        if (document.readyState === 'complete') {
            console.log('Page already loaded');
            callback();
        } else {
            window.addEventListener('load', function() {
                console.log('Page loaded');
                callback();
            });
        }
    },
    
    injectFarmGodScript: function(callback) {
        console.log('Injecting FarmGod script...');
        console.log('Current URL:', window.location.href);
        console.log('Window.$ available:', typeof window.$);
        
        if (typeof window.$ !== 'undefined' && window.$.getScript) {
            console.log('Executing FarmGod script using window.$ context...');
            
            // Execute using the farm tab's jQuery
            window.$.getScript('https://media.innogamescdn.com/com_DS_HU/scripts/farmgod.js');
            
            console.log('FarmGod script execution command sent');
            
            // Wait and check if it loaded
            var checkAttempts = 0;
            var checkInterval = setInterval(function() {
                checkAttempts++;
                
                if (typeof window.FarmGod !== 'undefined') {
                    console.log('FarmGod loaded successfully!');
                    clearInterval(checkInterval);
                    callback();
                } else if (checkAttempts >= 30) {
                    console.error('FarmGod failed to load after 15 seconds');
                    clearInterval(checkInterval);
                    throw new Error('FarmGod script failed to load');
                } else {
                    console.log('Waiting for FarmGod... (attempt ' + checkAttempts + '/30)');
                }
            }, 500);
            
        } else {
            console.error('Farm tab jQuery not available');
            throw new Error('Farm tab jQuery not available');
        }
    },
    
    waitForFarmGod: function(callback) {
        var attempts = 0;
        var maxAttempts = 50;
        
        var checkFarmGod = function() {
            attempts++;
            
            if (window.FarmGod && window.FarmGod.Main) {
                console.log('FarmGod is ready');
                callback();
            } else if (attempts >= maxAttempts) {
                throw new Error('FarmGod failed to initialize');
            } else {
                setTimeout(checkFarmGod, 100);
            }
        };
        
        checkFarmGod();
    },
    
    startContinuousFarming: function() {
        var self = this;
        console.log('Starting continuous farming with Enter pressing and progress monitoring...');
        
        this.isRunning = true;
        this.totalPresses = 0;
        
        // Start continuous Enter pressing
        this.pressTimer = setInterval(function() {
            self.pressEnter();
        }, 100); // Press every 100ms like Helper.js
        
        // Start progress monitoring
        this.progressTimer = setInterval(function() {
            self.monitorProgress();
        }, 100); // Check every 100ms like Helper.js
        
        // Start bot protection monitoring (80ms like original injection)
        this.botDetectionTimer = setInterval(function() {
            self.checkBotProtection();
        }, 80);
        
        console.log('Continuous farming started with bot protection monitoring');
    },
    
    pressEnter: function() {
        if (!this.isRunning) return;
        
        try {
            // Create Enter keydown event
            var enterDownEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            
            // Create Enter keyup event
            var enterUpEvent = new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
                bubbles: true,
                cancelable: true
            });
            
            // Send events to document
            document.dispatchEvent(enterDownEvent);
            document.dispatchEvent(enterUpEvent);
            
            // Also send to focused element if exists
            if (document.activeElement) {
                document.activeElement.dispatchEvent(enterDownEvent);
                document.activeElement.dispatchEvent(enterUpEvent);
            }
            
            this.totalPresses++;
            
            // Log every 50 presses
            if (this.totalPresses % 50 === 0) {
                console.log('Pressed Enter ' + this.totalPresses + ' times');
            }
            
        } catch (error) {
            console.error('Error pressing Enter:', error);
        }
    },
    
    monitorProgress: function() {
        if (!this.isRunning) return;
        
        try {
            // Look for FarmGod progress bar (same logic as Helper.js)
            var progressBar = document.getElementById('FarmGodProgessbar');
            
            if (!progressBar) {
                return; // Continue pressing if no progress bar found
            }
            
            // Get the progress text (like "176 / 176" or "107 / 170")
            var labelSpan = progressBar.querySelector('span.label');
            
            if (!labelSpan) {
                return;
            }
            
            var progressText = labelSpan.textContent.trim();
            
            // Get clean text (handles HTML like grey dots)
            var cleanText = labelSpan.innerText || labelSpan.textContent;
            console.log('Tab handler clean text:', cleanText);
            
            // Simple string-based parsing to avoid regex issues
            var originalTotal = null;
            var match = null;
            
            // Split by " / " to get parts
            var parts = cleanText.split(' / ');
            console.log('Tab handler split parts:', parts);
            
            if (parts.length === 2) {
                var currentStr = parts[0].trim();
                var totalStr = parts[1].trim();
                
                // Handle thousands separators in BOTH current and total
                if (currentStr.indexOf('.') !== -1) {
                    console.log('Tab handler current thousands separator detected: ' + currentStr + ' -> ' + currentStr.replace('.', ''));
                    currentStr = currentStr.replace('.', ''); // "1.552" -> "1552"
                }
                
                if (totalStr.indexOf('.') !== -1) {
                    console.log('Tab handler total thousands separator detected: ' + totalStr + ' -> ' + totalStr.replace('.', ''));
                    originalTotal = parseFloat(totalStr); // Keep original for reporting
                    totalStr = totalStr.replace('.', ''); // Remove thousands separator: "1.552" -> "1552"
                }
                
                // Create fake match array for compatibility
                match = [cleanText, currentStr, totalStr];
            }
            
            if (!match) {
                console.log('FarmGod Progress: Could not parse format "' + progressText + '"');
                return;
            }
            
            var current = parseInt(match[1]);
            var total = parseInt(match[2]);
            var percentage = total > 0 ? (current / total) * 100 : 0;
            
            // Debug logging for different formats
            if (progressText.indexOf('.') !== -1) {
                console.log('FarmGod Progress: Decimal format detected "' + progressText + '" -> ' + current + '/' + total + ' (rounded up)');
            }
            
            console.log('FarmGod Progress: ' + progressText + ' (' + percentage.toFixed(1) + '%)');
            console.log('Tab handler completion check: ' + current + ' >= ' + total + ' = ' + (current >= total));
            
            // Check if farming is complete
            if (current >= total) {
                console.log('Farming completed! Final: ' + progressText + ' (' + percentage.toFixed(1) + '%)');
                this.stopFarming();
                
                // Use original decimal value for reporting if available
                var reportedVillages = originalTotal !== null ? originalTotal : current;
                
                // Report success with detailed results
                this.reportResult('success', 'Farming completed successfully', {
                    villages: reportedVillages,
                    totalPresses: this.totalPresses,
                    finalProgress: progressText
                });
                return;
            }
            
        } catch (error) {
            console.error('Error monitoring progress:', error);
        }
    },
    
    stopFarming: function() {
        this.isRunning = false;
        
        // Clear timers
        if (this.pressTimer) {
            clearInterval(this.pressTimer);
            this.pressTimer = null;
        }
        
        if (this.progressTimer) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
        
        if (this.botDetectionTimer) {
            clearInterval(this.botDetectionTimer);
            this.botDetectionTimer = null;
        }
        
        console.log('Stopped farming. Total Enter presses: ' + this.totalPresses);
    },
    
    
    reportResult: function(status, message, extraData) {
        var result = {
            status: status,
            message: message,
            timestamp: Date.now(),
            error: status === 'error' ? message : null
        };
        
        // Add extra data if provided
        if (extraData) {
            result.villages = extraData.villages;
            result.totalPresses = extraData.totalPresses;
            result.finalProgress = extraData.finalProgress;
        }
        
        localStorage.setItem('norbi_farm_result', JSON.stringify(result));
        console.log('Result reported to engine');
    },
    
    // Bot Protection Detection with Communication to Engine
    checkBotProtection: function() {
        if (!this.isRunning) return;
        
        try {
            // Check for bot protection element (original detection method)
            var botElement = document.getElementById('botprotection_quest');
            
            if (botElement) {
                console.log('BOT PROTECTION DETECTED in farm tab! Stopping farming and notifying engine...');
                
                // Send message to engine tab for notifications
                try {
                    window.opener.postMessage({
                        source: 'norbi_farm_bot_detection',
                        message: 'Bot protection detected during active farming! Farming stopped immediately for safety.',
                        detectionMethod: 'botprotection_quest',
                        totalPresses: this.totalPresses,
                        timestamp: Date.now()
                    }, '*');
                    console.log('Notification message sent to engine tab');
                } catch (error) {
                    console.error('Failed to send message to engine tab:', error);
                }
                
                // Stop farming immediately
                this.stopFarming();
                
                // Report bot protection detection via localStorage (existing method)
                this.reportResult('error', 'Bot protection detected - farming stopped for safety', {
                    totalPresses: this.totalPresses,
                    error: 'Bot protection quest appeared'
                });
                
                return true; // Bot protection detected
            }
        } catch (error) {
            console.error('Error checking bot protection:', error);
        }
        
        return false; // No bot protection detected
    }
};

// =============================================================================
// AUTO-INITIALIZATION
// =============================================================================

(function() {
    'use strict';
    
    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNorbiFarm);
    } else {
        initializeNorbiFarm();
    }
    
    function initializeNorbiFarm() {
        // Check what page we're on and initialize accordingly
        if (window.location.href.indexOf('screen=am_farm') !== -1) {
            // We're on farm page - initialize farm tab handler
            NorbiFarmTabHandler.init();
        } else {
            // We're on any other page - initialize engine
            NorbiFarmEngine.init();
        }
    }
})();
