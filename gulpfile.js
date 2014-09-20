
var gulp = require('gulp');
var _ = require('lodash');
var size = require('gulp-size');
var yml = require('gulp-yml');
var print = require('gulp-print');
var stripBom = require('gulp-stripbom');
var removeEmptyLines = require('gulp-remove-empty-lines');
var plumber = require('gulp-plumber');
var jsonEditor = require('gulp-json-editor');
var jsonCombine = require('gulp-jsoncombine');
var moment = require('moment');
var argyle = require('./argyle');

gulp.task('jsonify', function(){
    return gulp.src('./source/posts/*.yaml')
        .pipe(print())
        .pipe(removeEmptyLines())
        .pipe(stripBom())
        .pipe(plumber())
        .pipe(yml())
        .pipe(argyle.cleanUpInput())
        .pipe(argyle.appendFileinfo())
        .pipe(argyle.validateInput())
        .pipe(argyle.hideHiddenPosts())
        .pipe(argyle.renderHtml())
        .pipe(argyle.renderYoutube())
        .pipe(argyle.renderImage())
        .pipe(argyle.renderIrc())
        .pipe(argyle.renderMarkdown())
        .pipe(argyle.catchUnrendered())
        .pipe(gulp.dest('./target/json/posts'));
});

gulp.task('config', function(){
    return gulp.src('./source/config.yaml')
        .pipe(yml())
        .pipe(gulp.dest('./target/json/'));
});

gulp.task('index', ['jsonify'], function(){
    return gulp.src('./target/json/posts/*.json')
        .pipe(argyle.stripNonIndexProperties())
        .pipe(jsonCombine("index.json",function(data){
            return new Buffer(JSON.stringify(data));   
        }))
        .pipe(jsonEditor(function(json){
            var newjson = {'index':[]}
            _.forEach(_.keys(json), function(key){
                // Add to index
                var obj = json[key];
                obj['id'] = key;
                newjson.index.push(obj);

                // Create categories
                _.forEach(obj.categories, function(category){
                    if(typeof newjson[category] === 'undefined'){
                        newjson[category] = [];
                    }
                    newjson[category].push(obj);
                });
            });
            _.forEach(_.keys(newjson), function(key){
                newjson[key].sort(function(a, b){
                    return moment(a.created) - moment(b.created);
                });
            });
            return newjson;
        }))
        .pipe(gulp.dest('./target/json/'));
});

gulp.task('compile_pretemplates', ['index', 'config'], function(){
    // TODO
});

gulp.task('compile_pages', function(){
    // TODO
});

gulp.task('compile_index', function(){
    // TODO
});

gulp.task('compile_RSS', function(){
    // TODO
});

gulp.task('compile_single', function(){
    // TODO
});

gulp.task('default', ['index', 'config'], function(){
    // TODO
});
