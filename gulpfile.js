
var gulp = require('gulp');
var size = require('gulp-size');
var yaml = require('gulp-yaml');
var yml = require('gulp-yml');
var print = require('gulp-print');
var indent = require('gulp-indent');
var stripBom = require('gulp-stripbom');
var removeEmptyLines = require('gulp-remove-empty-lines');
var plumber = require('gulp-plumber')
var jsonEditor = require('gulp-json-editor')
var jsonCombine = require('gulp-jsoncombine')

var renderYoutube = jsonEditor(function(json){
    var content_type = json['content-type'];
    var width = 560;
    var height = 315;
    if(content_type === 'youtube'){
        var youtubekey = json['youtube'];
        json['html'] = "<iframe width=\""+width+"\" height=\""+height+"\" src=\"//www.youtube.com/embed/"+youtubekey+"\" frameborder=\"0\" allowfullscreen></iframe>"
    }
    return json;
});

var renderComic = jsonEditor(function(json){

});

gulp.task('default', function(){
    return gulp.src('../Blog/*.yaml')
        .pipe(print())
        .pipe(removeEmptyLines())
        .pipe(stripBom())
        .pipe(plumber())
        .pipe(yml())
        .pipe(jsonEditor(function(json){
            // Tidy up content_type and alt_text
            if(typeof json['content_type'] !== 'undefined'){
                json['content-type'] = json['content_type']
                delete json['content_type']
            }
            if(typeof json['alt_text'] !== 'undefined'){
                json['alt-text'] = json['alt_text']
                delete json['alt_text']
            }
            if(typeof json['content-type'] === 'undefined'){
                throw "YAML elements must contain a content-type directive"
            }
            if( typeof json['visible'] !== 'undefined' &&
                json['visible'] == false){
                throw "Hiding this blog post." 
            }
            return json;
        }))
        .pipe(renderYoutube)
        .pipe(gulp.dest('./_json'));
});

gulp.task('index', function(){
    return gulp.src('./_json/*.json')
        .pipe(jsonEditor(function(json){
            delete json['content-type'];
            delete json['content'];
            delete json['visible'];
        }))
        .pipe(jsonCombine("index.json",function(data){
            //console.log(data) 
            return new Buffer(JSON.stringify(data));   
        }))
        .pipe(gulp.dest('./_json'));
});
