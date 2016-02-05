'use strict';

var gulp = require('gulp');
var bower = require('gulp-bower');
var browserify = require('browserify');
var less = require('gulp-less');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');
var babelify = require('babelify');
var vueify = require('vueify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

const DIST_DIR = 'dist/';
const COMPONENTS_DIR = `${DIST_DIR}components/`;

gulp.task('collect:bower', () => {
  return bower()
    .pipe(gulp.dest(COMPONENTS_DIR));
});

gulp.task('collect:vendor', () => {
  return gulp.src('vendor/**/*')
    .pipe(gulp.dest(COMPONENTS_DIR));
});

gulp.task('collect', ['collect:bower', 'collect:vendor']);

gulp.task('build:less', ['collect'], () => {
  gulp.src('less/style.less')
    .pipe(sourcemaps.init())
    .pipe(less())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(`${DIST_DIR}css`));
});

gulp.task('build:js', ['collect'], () => {
  return browserify({
      entries: './js/web/app.js',
      debug: true,
      paths: [__dirname]
    })
      .transform(vueify)
      .transform(babelify)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(`${DIST_DIR}js`));
});

gulp.task('build', ['build:less', 'build:js']);

gulp.task('watch', ['build'], () => {
  gulp.watch('js/web/**/*', ['build:js']);
  gulp.watch('components/**/*', ['build:js']);
  gulp.watch('less/**/*', ['build:less']);
});

gulp.task('default', ['build']);
