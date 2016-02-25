'use strict';

const gulp = require('gulp');
const bower = require('gulp-bower');
const less = require('gulp-less');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');
const livereload = require('gulp-livereload');
const gutil = require('gulp-util');

const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

const browserify = require('browserify');
const babelify = require('babelify');
const vueify = require('vueify');
const watchify = require('watchify');

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
    .pipe(gulp.dest(`${DIST_DIR}css`))
    .pipe(livereload());
});

function bundle(watch) {
  var b = browserify({
    entries: './js/web/app.js',
    debug: true,
    paths: [__dirname],
    cache: {},
    packageCache: {}
  })
    .transform(vueify)
    .transform(babelify, {'presets': ['es2015']})
    .transform('browserify-css')
    .on('log', gutil.log);

  if (watch) {
    b = watchify(b);
  }

  function rebundle() {
    return b.bundle()
      .on('error', function(err) { console.error(err); this.emit('end'); })
      .pipe(source('bundle.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(`${DIST_DIR}js`))
      .pipe(livereload());
  }

  b.on('update', rebundle);
  return rebundle();
}

gulp.task('build:js', ['collect'], () => {
  bundle(false);
});

gulp.task('build', ['build:less', 'build:js']);

gulp.task('watch', ['build:less'], () => {
  bundle(true);

  livereload.listen();
  gulp.watch('less/**/*', ['build:less']);
});

gulp.task('default', ['build']);
