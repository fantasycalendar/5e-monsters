"use strict";

// Dependencies
const { src, dest, series, parallel, task, watch } = require('gulp');
var config = require('./gulp.config.js')();
const colors = require('ansi-colors');
const del = require('del');
const log = require('fancy-log');
const angularTemplateCache = require('gulp-angular-templatecache');
const csso = require('gulp-csso');
const filter = require('gulp-filter');
const gulpif = require('gulp-if');
const inject = require('gulp-inject');
const minifyHTML = require('gulp-minify-html');
const gulporder = require('gulp-order');
const replace = require('gulp-replace');
const rev = require('gulp-rev');
const revReplace = require('gulp-rev-replace');
var sass = require('gulp-sass')(require('sass'));
const taskListing = require('gulp-task-listing');
const uglify = require('gulp-uglify');
const useref = require('gulp-useref');

const dev = require('yargs').argv.dev;

task('help', taskListing); // Lists all public tasks

/***** Helper Functions *****/

function clean(path, done) {
    log('Cleaning: ' + colors.blue(path));
    del(path, { force: true }).then(paths => done());
}

function injectAtLabels(source, label, order) { // Injects the source file/s into the target file/s at defined placeholder labels
    var options = { addRootSlash: false };
    if (label) {
        options.name = 'inject:' + label;
    }

    return inject(orderSrc(source, order), options).on('error', log);
}

function orderSrc(source, order) {
    return src(source)
        .pipe(gulpif(order, gulporder(order)));
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
    log(colors.blue('Creating an AngularJS $templateCache'));

    return src(config.htmltemplates)
        .pipe(minifyHTML({ empty: true }))
        .pipe(gulporder(['*']))
        .pipe(angularTemplateCache(
            config.templateCache.file,
            config.templateCache.options
        ))
        .pipe(dest(config.temp));
}));

task('remove-template', function () {
    log(colors.blue('Removing template'));

    return src(config.index)
        .pipe(replace(
            /(<!-- inject:templates:js -->)(?:[\S\s]*?)(<!-- endinject -->)/gmi,
            '$1\r\n\t$2'
        ))
        .pipe(dest(config.root));
});

/***** Helper Tasks: Sass -> CSS ******/

task('compile-sass', series(cleanStyles, function () {
    log(colors.blue('Compiling SASS --> CSS'));

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

// The default task which injects everything built (Sass (CSS), angular js) into ./index.html
// Does this by first compiling Sass -> CSS, then building the angular JS template, then injecting into the <!-- inject --> tags in ./index.html
task('default', series(injectDependencies, function () {
    log(colors.blue('Prepare CSS, JS, then inject into HTML'));

    var result = src(config.index)
        .pipe(injectAtLabels(config.cssFile))
        .pipe(injectAtLabels(config.js, '', config.jsOrder));

    // Only put in the template cache if we're not in dev mode
    if ( !dev ) {
        var templateCache = config.temp + config.templateCache.file;
        result = result.pipe(injectAtLabels(templateCache, 'templates'));
    }

    result = result.pipe(dest(config.root));

    return result;
}));

/***** Optimisation ******/

task('optimize', series('default', cleanBuild, function () {
    var cssFilter = filter('./styles/*.css', {restore: true});
    var jsAppFilter = filter('**/' + config.optimized.app, {restore: true});
    var indexHtmlFilter = filter(['**/*', '!**/index.html'], { restore: true });
    return src(config.index)
        .pipe(useref())
        .pipe(cssFilter)
            .pipe(csso())
            .pipe(cssFilter.restore)
        .pipe(jsAppFilter)
            .pipe(uglify())
            .pipe(jsAppFilter.restore)
        .pipe(indexHtmlFilter)
            .pipe(rev())
            .pipe(indexHtmlFilter.restore)
        .pipe(revReplace())
        .pipe(dest(config.build));
})
);

/***** Build /docs *****/
// Purpose: To serve something for GitHub pages to build

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

task('export', series('optimize', 'copy-resources')); 