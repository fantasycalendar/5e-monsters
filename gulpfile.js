"use strict";

// For Gulp3 documentation see https://github.com/gulpjs/gulp/blob/v3.9.1/docs/API.md

const { src, dest, series, parallel, task, watch } = require('gulp');
const $ = require('gulp-load-plugins')({ lazy: true });
const replace = require('gulp-replace');
const del = require('del');
const dev = require('yargs').argv.dev;
var sass = require('gulp-sass')(require('sass'));
var config = require('./gulp.config.js')();

task('help', $.taskListing); // Lists all public tasks

/***** Helper Functions *****/

function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path, { force: true }).then(paths => done());
}

function log(msg) {
    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

function inject(source, label, order) {
    var options = { addRootSlash: false };
    if (label) {
        options.name = 'inject:' + label;
    }

    return $.inject(orderSrc(source, order), options).on('error', log);
}

function orderSrc(source, order) {
    return src(source)
        .pipe($.if(order, $.order(order)));
}

/***** Helper Functions: Cleaning *****/

function cleanStyles(done) {
    clean(config.cssFile, done);
}

function cleanCode(done) {
    var files = [].concat(
        config.temp + '**/*.js'
    );
    clean(files, done);
}

function cleanBuild(done) {
    clean(config.buildFiles, done);
}

/***** Helper Tasks: Template Building *****/

task('template-cache', series(cleanCode, function () {
    log('Creating an AngularJS $templateCache');

    return src(config.htmltemplates)
        .pipe($.minifyHtml({ empty: true }))
        .pipe($.order(['*']))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options
        ))
        .pipe(dest(config.temp));
}));

task('remove-template', function () {
    log('Removing template');

    return src(config.index)
        .pipe(replace(
            /(<!-- inject:templates:js -->)(?:[\S\s]*?)(<!-- endinject -->)/gmi,
            '$1\r\n\t$2'
        ))
        .pipe(dest(config.root));
});

/***** Helper Tasks: Sass -> CSS ******/

task('compile-sass', series(cleanStyles, function () {
    log('Compiling SASS --> CSS');

    return src(config.sassDir)
        .pipe(sass())
        .pipe(dest(config.cssDir));
}));

task('sass-watcher', function () {
    watch(config.sassWatchFiles, series('compile-sass'));
});

/**** Main Tasks  *****/

// If we're in dev mode, the template.js file will be removed from index.html
var injectDependencies = ['compile-sass'];
if ( dev ) {
    injectDependencies.push('remove-template');
} else {
    injectDependencies.push('template-cache');
}

task('inject', series(injectDependencies, function () { // first run compile-sass, then template-cache, then finally run inject
    log('Wire up css and js into the html, after files are ready');

    var result = src(config.index)
        .pipe(inject(config.cssFile))
        .pipe(inject(config.js, '', config.jsOrder));

    // Only put in the template cache if we're not in dev mode
    if ( !dev ) {
        var templateCache = config.temp + config.templateCache.file;
        result = result.pipe(inject(templateCache, 'templates'));
    }

    result = result.pipe(dest(config.root));

    return result;
}));

task('default', series('inject')); // 

/***** Optimisation ******/

/***** Helper Tasks: Copying *****/

function copyThirdParty() {
    return src(config.root + '/thirdparty/**/*')
        .pipe(dest(config.root + '/' + config.build + '/thirdparty'));
}

function copyJSON() {
    return src(config.root + '/json/**/*')
        .pipe(dest(config.root + '/' + config.build + '/json'));
}

function copyImages() {
    return src(config.root + '/images/**/*')
        .pipe(dest(config.root + '/' + config.build + '/images'));
}

function copyManifest() {
    return src(config.root + './manifest.json')
        .pipe(dest(config.root + '/' + config.build));
}

function copyCNAME() {
    return src(config.root + './CNAME')
        .pipe(dest(config.root + '/' + config.build));
}

task('copy-resources', series(copyThirdParty, copyJSON, copyImages, copyManifest, copyCNAME)); // In testing, no appreciable benefit in parallelising this task

/**** Optimisation Task *****/

task('optimize', series('inject', cleanBuild, 'copy-resources', function () {
    var cssFilter = $.filter('./styles/*.css', {restore: true});
    // TODO: JS filter temporarily disabled until the dependency injection issue is resolved
    // var jsAppFilter = $.filter('**/' + config.optimized.app, {restore: true});
    // comment: Dependency injection has been resolved, uncomment this.
    var indexHtmlFilter = $.filter(['**/*', '!**/index.html'], { restore: true });
    return src(config.index)
        .pipe($.useref())
        .pipe(cssFilter)
            .pipe($.csso())
            .pipe(cssFilter.restore)
        // .pipe(jsAppFilter)
        //     .pipe($.uglify())
        //     .pipe(jsAppFilter.restore)
        .pipe(indexHtmlFilter)
            .pipe($.rev())
            .pipe(indexHtmlFilter.restore)
        .pipe($.revReplace())
        .pipe(dest(config.build));
}));
