'use strict'
/**
 * Registers pos-bridge.js as a Windows Service (auto-start, runs silently).
 * Run once as Administrator:  node install-service.js
 * To remove:                  node install-service.js --uninstall
 */

const path    = require('path')
const Service = require('node-windows').Service

const svc = new Service({
  name:           'SmartResto POS Bridge',
  description:    'Intercepts cash-register print jobs and syncs them to SmartResto cloud.',
  script:         path.join(__dirname, 'pos-bridge.js'),
  nodeOptions:    [],
  // Restart policy: restart up to 3 times within 60 s, then wait 2 min
  maxRestarts:    3,
  maxRetries:     3,
  wait:           2,
  grow:           0.5,
})

const uninstall = process.argv.includes('--uninstall')

if (uninstall) {
  svc.on('uninstall', () => console.log('✅ Service uninstalled.'))
  svc.uninstall()
} else {
  svc.on('install', () => {
    svc.start()
    console.log('✅ Service installed and started.')
    console.log('   Manage it:  services.msc  →  SmartResto POS Bridge')
  })
  svc.on('alreadyinstalled', () => {
    console.log('ℹ️  Service already installed. Run with --uninstall first to reinstall.')
  })
  svc.install()
}
