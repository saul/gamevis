'use strict';

var gulp = require('gulp');
var bower = require('gulp-bower');
var less = require('gulp-less');
var sourcemaps = require('gulp-sourcemaps');
var babel = require('gulp-babel');

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
  return gulp.src('js/web/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(`${DIST_DIR}js`));
});

gulp.task('build', ['build:less', 'build:js']);

gulp.task('watch', ['build'], () => {
  gulp.watch('js/**/*', ['build:js']);
  gulp.watch('less/**/*', ['build:less']);
});

gulp.task('default', ['build']);
