var _ = require('lodash');
var jsonEditor = require('gulp-json-editor');
var safe = require('escape-html');
var marked = require('marked');
var through = require('through2');
var moment = require('moment');
var PluginError = require('gulp-util').PluginError;

function cleanUpInput(json){
    // Tidy up content_type and alt_text
    if(typeof json['content_type'] !== 'undefined'){
        json['content-type'] = json['content_type']
        delete json['content_type']
    }
    if(typeof json['alt_text'] !== 'undefined'){
        json['alt-text'] = json['alt_text']
        delete json['alt_text']
    }
    return json;
}

function validateInput(json){
    // Some basic checks to make sure the input will work. 
    if(typeof json['content-type'] === 'undefined'){
        throw "YAML elements must contain a content-type directive"
    }
    return json;
}

function hideHiddenPosts(json){
    // If posts have 'hidden:true', they shouldn't go through the pipeline
    if(typeof json['visible'] !== 'undefined' &&
        json['visible'] == false){
        return {};
    }
    return json;
}

function tidyInput(json){
    return hideHiddenPosts(validateInput(cleanUpInput(json)));
}

function renderYoutube(json){
    // Convert "youtube:pQ6RTUcNqNk" into a youtube embed link. 
    var content_type = json['content-type'];
    var width = 854;
    var height = 480;
    if(content_type === 'youtube'){
        var youtubekey = json['youtube'];
        json['html'] = "\n<iframe class='youtube' width=\""+width+"\" height=\""+height+"\" src=\"http://www.youtube.com/embed/"+youtubekey+"\" frameborder=\"0\" allowfullscreen></iframe>"
    }
    return json;
}

function renderImage(json){
    // Convert "image:http://sample.org/image.gif" into an <img> link.
    // Also works on "comic:http://sample.org/image.gif"
    var content_type = json['content-type'];
    if(content_type === 'comic' || content_type === 'image'){
        var url;
        var alt_text = "";
        if(typeof json['comic'] !== 'undefined'){
            url = json['comic'];
        }
        if(typeof json['image'] !== 'undefined'){
            url = json['image'];
        }
        if(typeof url === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        if(typeof json['alt-text'] !== 'undefined'){
            alt_text = json['alt-text']
        }
        json['html'] = ""
        if(typeof url === "string"){
            json['html'] = "\n<img src=\""+url+"\" alt-text=\""+safe(alt_text)+"\">"
        }
        else{
            _.forEach(url, function(image){
                json['html'] += "\n<img src=\""+image+"\" alt-text=\""+safe(alt_text)+"\">"
            });
        }
    }
    return json;
}

function renderHtml(json){
    // Kind of a no-op.
    var content_type = json['content-type'];
    if(content_type === 'html'){
        var content = "";
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof json['html'] !== 'undefined'){
            content = json['html'];
        }
        if(typeof content !== 'undefined'){
            json['html'] = content;
        }
    }
    return json;
}

function renderMarkdown(json){
    var content_type = json['content-type'];
    if(content_type === 'markdown'){
        var content = "";
        if(typeof json['markdown'] !== 'undefined'){
            content = json['markdown'];
        }
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof content === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        json['html'] = "";
        if(typeof content === "string"){
            json['html'] = marked(content);
        }
        else{
            _.forEach(content, function(c){
                json['html'] += marked(c) + "<br />";
            });
        }
    }
    return json;
}

function renderIrc(json){
    var content_type = json['content-type'];
    if(content_type === 'irc'){
        var content = "";
        if(typeof json['irc'] !== 'undefined'){
            content = json['irc'];
        }
        if(typeof json['content'] !== 'undefined'){
            content = json['content'];
        }
        if(typeof content === 'undefined'){
            throw "Articles with content-type '"+content_type+"' must have a '"+content_type+"' element";
        }
        json['html'] = "<ul class='irc'>";
        // For each line in content, split into <name> content
        // then display like <li><strong class='name'>name</strong> content</li>
        var lines = content.split("\n");
        _(lines).forEach(function(line){
            if(/<\S+>.*/.test(line)){
                var matches = line.match(/<(\S+)>(.*)/);
                var name = safe(matches[1]);
                var message = safe(matches[2]);
                json['html'] += "<li><strong class='name'>"+name+"</strong> "+message+"</li>\n";
            }
        });
        json['html'] += "</ul>";
    }
    return json;
}

var default_list_of_renderers = [
    renderYoutube,
    renderImage,
    renderHtml,
    renderMarkdown,
    renderIrc
];

function catchUnrendered(json){
    // Throw an error if nothing has rendered this json yet. 
    var content_type = json['content-type'];
    if(typeof json['html'] === 'undefined'){
        throw "I couldn't find a renderer for " + content_type
    }
    return json;
}

function stripNonIndexProperties(json){
    newjson = {};
    newjson['created'] = json['created'];
    newjson['categories'] = json['categories'];
    newjson['title'] = json['title'];
    newjson['id'] = json['id'];
    return newjson;
};

function sortPost(a, b){
    return moment(a.created) - moment(b.created);
}

function buildIndex(json){
    // Take a json containing an concatenated JSON object 
    //  made of posts - 
    //   { 'filename': {~postdata~}, 'filename2': {~postdata~} }
    // and replace it with a list of posts in chronological order
    //   [ {~postdata~}, {~postdata~} ]
    var newjson = []
    _.forEach(_.keys(json), function(key){ 
        if( typeof json[key]['title'] !== 'undefined' ){
            newjson.push(json[key]); 
        }
    });
    newjson.sort(sortPost);
    return newjson;
}

function buildCategories(json){
    // Take a json containing an concatenated JSON object 
    //  made of posts - 
    //   { 'filename': {~postdata~}, 'filename2': {~postdata~} }
    // and replace it with an object containing lists of posts by category
    //   {'category1': [{~postdata~}, {~postdata~}], 'category2':[...] }
    var newjson = {}
    _.forEach(_.keys(json), function(key){ 
        var obj = json[key];
        _.forEach(obj.categories, function(category){
            if(typeof newjson[category] === 'undefined'){
                newjson[category] = [];
            }
            newjson[category].push(obj);
        });
    });
    _.forEach(_.keys(newjson), function(key){
        newjson[key].sort(sortPost);
    });
    return newjson;
};

function buildReverseCategories(json){
    // Take a json containing an concatenated JSON object 
    //  made of posts - 
    //   { 'filename': {~postdata~}, 'filename2': {~postdata~} }
    // and replace it with an object containing lists of posts by category in reverse
    //   {'category1': [{~postdata~}, {~postdata~}], 'category2':[...] }
    var newjson = {}
    _.forEach(_.keys(json), function(key){ 
        var obj = json[key];
        _.forEach(obj.categories, function(category){
            if(typeof newjson[category] === 'undefined'){
                newjson[category] = [];
            }
            newjson[category].push(obj);
        });
    });
    _.forEach(_.keys(newjson), function(key){
        newjson[key].sort(sortPost);
        newjson[key].reverse();
    });
    return newjson;
};

function addMetadataToPost(post, master, index){
    // First, Last, Previous, Next
    post['first'] = master.index[0];
    post['last'] = master.index[master.index.length-1];
    if(typeof index === 'undefined'){
        index = _.findIndex(master.index, function(p){
            return p.id === post.id;
        });
    }
    if( index > 0 ){
        post['previous'] = master.index[index-1]
    }
    if( index < master.index.length-1 ){
        post['next'] = master.index[index+1]
    }

    // Category First, Last, Previous, Next
    post.category_items = []
    _.forEach(post.categories, function(category){
        var category_list = master.categories[category]
        var category_descriptor = { 'name':category };
        category_descriptor['first'] = category_list[0]
        category_descriptor['last'] = category_list[category_list.length-1]
        var index_in_category = _.findIndex(category_list, function(p){
            return p.id === post.id;
        })
        if( index_in_category > 0 ){
            category_descriptor['previous'] = category_list[index_in_category-1];
        }
        if( index_in_category < category_list.length-1 ){
            category_descriptor['next'] = category_list[index_in_category+1];
        }
        post.category_items.push(category_descriptor);
    });

    // Date
    var date = moment(post['created']);
    post['pubdate'] = date.format("ddd, DD MMM YYYY HH:mm:ss Z");

    var datetime_format = "LLLL";
    if(typeof master.config.datetime_format !== 'undefined'){
        datetime_format = master.config.datetime_format;    
    }
    post['human_datetime'] = date.format(datetime_format);

    var date_format = "LL";
    if(typeof master.config.date_format !== 'undefined'){
        date_format = master.config.date_format;    
    }
    post['human_date'] = date.format(date_format);
    
    var time_format = "LT";
    if(typeof master.config.time_format !== 'undefined'){
        time_format = master.config.time_format;    
    }
    post['human_time'] = date.format(time_format);

    return post;
};

function addMetadataToMaster(master){
    master['first'] = master.index[0];
    master['last'] = master.index[master.index.length-1];
    _.forEach(master.index, function(post, index){
        post = addMetadataToPost(post, master, index);
    });
    master.index.reverse();
    return master;
};


module.exports = {
    appendFileinfo:function(){
        // This gulp plugin takes a json object and appends it's filename to
        // it as a property - so "C://curtis/arglebargle.json"
        // gets the added properties
        //   'filename': 'arglebargle.json'
        //   'path': 'C://curtis/arglebargle.json"
        //   'base': 'C://curtis/"
        //   'id': 'arglebargle'
        return through.obj(function(file, encoding, callback){
            if(file.isNull()){
                this.push(file);
                return callback();
            }
            if(file.isStream()){
                this.emit('error', new PluginError('argyle', 'Streaming is not supported'));
                return callback();
            }
            try {
                var utf8 = file.contents.toString('utf8');
                var json = JSON.parse(utf8);
                json['path'] = file.path;
                json['base'] = file.base;
                json['filename'] = file.path.replace(/^.*[\\\/]/, '');
                json['id'] = json['filename'].slice(0, -5);
                file.contents = new Buffer(JSON.stringify(json));
            }
            catch (err) {
                this.emit('error', new PluginError('argyle', err));
            }
            this.push(file);
            callback();
        });
    },
    tidyInput:function(){
        return jsonEditor(tidyInput);
    },
    renderYoutube:renderYoutube,
    renderImage:renderImage,
    renderHtml:renderHtml,
    renderMarkdown:renderMarkdown,
    renderIrc:renderIrc,
    default_list_of_renderers:default_list_of_renderers,
    render:function(list_of_renderers){
        if(typeof list_of_renderers === 'undefined'){
            list_of_renderers = default_list_of_renderers;
        }
        return jsonEditor(function(json){
            _(list_of_renderers).forEach(function(renderer){
                json = renderer(json);
            });
            return catchUnrendered(json);
        });
        
    },
    stripNonIndexProperties: function(){return jsonEditor(stripNonIndexProperties);},
    buildIndex: function(){return jsonEditor(buildIndex)},
    buildCategories: function(){return jsonEditor(buildCategories)},
    buildReverseCategories: function(){return jsonEditor(buildReverseCategories)},
    addMetadataToPost: addMetadataToPost,
    addMetadataToMaster: addMetadataToMaster,
};
