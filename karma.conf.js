// Karma configuration
// Generated on Tue Aug 24 2021 10:50:28 GMT+0000 (Coordinated Universal Time)

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: './app',


    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ['jasmine', 
      'sinon', 
      'jasmine-sinon'
    ],


    // list of files / patterns to load in the browser
    files: [
      '../thirdparty/angular/angular.js',
      '../thirdparty/angular-ui-router/release/angular-ui-router.js',
      '../thirdparty/angular-mocks/angular-mocks.js',
      '../thirdparty/angular-touch/angular-touch.js',
      '../thirdparty/dirPagination/dirPagination.js',
      '../thirdparty/lodash.js',
      '../thirdparty/angular-local-storage/angular-local-storage.js',
      '../scripts/bardjs/dist/bard.js',
      '*.js',
      '**/*.js',
      '../scripts/**/*.js'
    ],


    // list of files / patterns to exclude
    exclude: [
      '../scripts/bardjs/tests/*.js',
      '../scripts/bardjs/*.js'
    ],

    // Use a reporter to print detailed results
    reporters: ['spec'],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
    preprocessors: {
    },

    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    // browsers: ['Chrome', 'Firefox'],


    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity
  })
}
