/*
 * grunt-sh-precompile
 *
 *
 * Copyright (c) 2014 jack chen
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    // Please see the Grunt documentation for more information regarding task
    // creation: http://gruntjs.com/creating-tasks

    grunt.registerMultiTask('sh_precompile', 'Pre compile DUST template, and this is not a generic grunt plugin', function() {
         // Merge task-specific and/or target-specific options with these defaults.
        var options = this.options({
                templatesFolder: 'templates',
                scriptsFolder: 'scripts',
                localesFolder: 'locales',
                commonPropsSrc: ['common/**/*.properties'],
                scriptsPropsSrc: ['scripts/**/*.properties'],
                scriptsPropsFileName: 'i18nPropsForScripts'
            }),
            filesSrc = this.filesSrc,
            i18nRegExp = /\{@i18n\s+?key=["](.+?)["]\s*?\/}/gmi,
            dustRegExp = /\.dust$/,
            jsRegExp = /\.js$/,
            propsRegExp = /\.properties$/,
            multiLineRegExp = /\\\r?\n\s*/g,
            missingKeyRegExp = /(\{\{.*\}\})/,
            path = require('path'),
            sep = path.sep,
            eol = require('os').EOL,
            fs = require('fs'),
            i18nPropsForScriptsTemplateFile = '../i18nPropsForScripts.tpl',
            util = {};

        util = {
            // locales list is an array containing normalized Country-lang code list, e.g. ['de-de', 'en-us', 'en-gb'];
            localesList: [],
            // templates list is an array containing all of dust for each locale, e.g. ['build-dev/resources/shape/locales/de-de/templates/home.dust','build-dev/resources/shape/locales/en-gb/templates/home.dust','build-dev/resources/shape/locales/en-us/templates/home.dust','build-dev/resources/shape/locales/de-de/templates/header.dust',...];
            templatesList: [],
            // common properties JSON list contains the locale - commonPropsJson, e.g. [{'de-de': {'k1':'v1', 'k2':'v2'}}, {'en-gb': {'k1':'v1gb', 'k2':'v2gb'}}]
            commonPropsJsonList: [],
            // scripts properties JSON list contains the locale - scriptsPropsJson, similar with the variable commonPropsJsonList
            scriptsPropsJsonList: [],

            getLocalesList: function (){
                // This will return the reference to the localesList, so any modification to this returned object will reflect to the original localesList
                // the same rule also apply to the templatesList, commonPropsJsonList and scriptsPropsJsonList
                return this.localesList;
            },

            setLocalesList: function (list){
                this.localesList = list;
            },

            getTemplatesList: function (){
                return this.templatesList;
            },

            setTemplatesList: function (list){
                this.templatesList = list;
            },

            getCommonPropsJsonList: function (){
                return this.commonPropsJsonList;
            },

            setCommonPropsJsonList: function (list){
                this.commonPropsJsonList = list;
            },

            getScriptsPropsJsonList: function (){
                return this.scriptsPropsJsonList;
            },

            setScriptsPropsJsonList: function (list){
                this.scriptsPropsJsonList = list;
            },

            endsWith: function(str, suffix) {
                return str.substring(str.length - suffix.length, str.length) === suffix;
            },

            extend: function(target){
                var sources = [].slice.call(arguments, 1);
                sources.forEach(function (source) {
                    for (var prop in source) {
                        if(Object.hasOwnProperty.call(source, prop)){
                            target[prop] = source[prop];   
                        }
                    }
                });
                return target;
            },

            isEmpty: function(val){
                return (typeof val === 'undefined') || val === null;
            },

            createSpace: function(num){
                // Default create 4 spaces
                num = (num || 4) + 1;
                return new Array(num).join(' ');
            },

            _convertStringIfTrue: function (original) {
                var str;
                if (original && typeof original === "string") {
                    str = original.toLowerCase().trim();
                    return (str === "true" || str === "false") ? (str === "true") : original;
                }
                return original;
            },

            convertPropsToJson: function (text) {
                var jsonObj = {},
                    _this = this;

                if (text && text.length) {
                    // handle multi-line values terminated with a backslash
                    text = text.replace(multiLineRegExp, '');
                    text.split(/\r?\n/g).forEach(function (line) {
                        var props,
                            name,
                            val;
                        line = line.trim();
                        if (line && line.indexOf("#") !== 0 && line.indexOf("!") !== 0) {
                            props = line.split(/\=(.+)?/);
                            name = props[0] && props[0].trim();
                            val = props[1] && props[1].trim();
                            jsonObj[name] = _this._convertStringIfTrue(val);
                        }
                    });
                }
                return jsonObj;
            },

            getLocaleFromFilePath: function(filePath, localesRootPath){
                var relativePath = path.relative(localesRootPath, filePath),
                    locale = relativePath.split(sep)[0];

                  return locale;
            },

            getNormalizedLocale: function(locale) {
                return !!locale ? locale : this.getDefaultLocale();
            },

            getDefaultLocale: function(){
                return 'en-us';
            },

            // To get all of the available locales list, commonPropsJsonList, scriptsPropsJsonList
            init: function (options){
                var _this = this,
                    localesRootPath = options.localesRootPath,
                    scriptsPropsSrc = options.scriptsPropsSrc,
                    commonPropsSrc = options.commonPropsSrc,
                    localesList = this.getLocalesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList(),
                    scriptsPropsJsonList = this.getScriptsPropsJsonList();

                grunt.verbose.writeln('============localesRootPath=======', localesRootPath);

                fs.readdirSync(localesRootPath).forEach(function(locale) {
                    var commonLocalePropsSrc = [],
                        commonPropsFileArr = [],
                        commonLocalePropsJson = {},
                        commonPropsJson = {},
                        scriptsLocalePropsSrc = [],
                        scriptsPropsFileArr = [],
                        scriptsLocalePropsJson = {},
                        scriptsPropsJson = {};

                    locale = _this.getNormalizedLocale(locale);

                    if (localesList.indexOf(locale) === -1) {
                        
                        // put the locale to the util.localesList array and reset the commonLocalePropsSrc which will hold all the common properties for the specified loale
                        localesList.push(locale);
                        /*
                        ** constructure the commonPropsJsonList for each locale
                        */
                        // Re-constructure the commonPropsSrc, actually this is an array, but we need to re-build the common properties file pattern
                        // Since by default, all file paths are relative to the `Gruntfile`, please have a reference: 
                        // http://gruntjs.com/api/grunt.file#grunt.file.setbase and http://gruntjs.com/api/grunt.file#grunt.file.expand
                        commonLocalePropsSrc = commonPropsSrc.map(function(commonPropsFilePattern, idx){
                            return path.join(localesRootPath, locale, commonPropsFilePattern);
                        });

                        commonPropsFileArr = grunt.file.expand(commonLocalePropsSrc);

                        commonPropsFileArr.forEach(function(file, idx){
                            var jsonObj = grunt.file.exists(file) ? _this.convertPropsToJson(grunt.file.read(file)) : {};
                            commonLocalePropsJson = _this.extend({}, commonLocalePropsJson, jsonObj);
                        });

                        commonPropsJson[locale] = commonLocalePropsJson;
                        commonPropsJsonList.push(commonPropsJson);

                        // logic to handle the scripts properties file, generate a combiled properties file for each locale
                        // then convert it to a JS file conform to the require js syntax
                        scriptsLocalePropsSrc = scriptsPropsSrc.map(function(scriptsPropsFilePattern, idx){
                            return path.join(localesRootPath, locale, scriptsPropsFilePattern);
                        });

                        scriptsPropsFileArr = grunt.file.expand(scriptsLocalePropsSrc);

                        scriptsPropsFileArr.forEach(function(file, idx){
                            var jsonObj = grunt.file.exists(file) ? _this.convertPropsToJson(grunt.file.read(file)) : {};
                            scriptsLocalePropsJson = _this.extend({}, scriptsLocalePropsJson, jsonObj);
                        });

                        scriptsPropsJson[locale] = scriptsLocalePropsJson;
                        scriptsPropsJsonList.push(scriptsPropsJson);
                        
                    }
                });

                grunt.log.subhead('[precompile] ==== available locale list is: ', localesList);
                grunt.log.writeln('[precompile] ==== commonPropsJsonList is: ', commonPropsJsonList);
                grunt.log.writeln('[precompile] ==== scriptsPropsJsonList is: ', scriptsPropsJsonList);

            },
            // Combile commonPropsJson with scriptsPropsJson to generate a new sripts properties for each locale
            generateScriptsProps: function (options){

                var localesRootPath = options.localesRootPath,
                    scriptsFolder = options.scriptsFolder,
                    scriptsPropsFileName = options.scriptsPropsFileName,
                    localesList = this.getLocalesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList(),
                    scriptsPropsJsonList = this.getScriptsPropsJsonList(),
                    _this = this;

                localesList.forEach(function(locale, idx){
                    var commonPropsJson = {},
                        scriptsPropsJson = {},
                        content = '',
                        destPath = path.join(localesRootPath, locale, scriptsFolder, scriptsPropsFileName + '.js');

                    commonPropsJsonList.every(function(obj){
                        if(obj[locale]){
                            commonPropsJson = obj[locale];
                            return false;
                        }
                        else{
                            return true;
                        }
                    });

                    scriptsPropsJsonList.every(function(obj){
                        if(obj[locale]){
                            scriptsPropsJson = obj[locale];
                            return false;
                        }
                        else{
                            return true;
                        }
                    });

                    scriptsPropsJson = _this.extend({}, commonPropsJson, scriptsPropsJson);
                    
                    grunt.verbose.subhead('**** scriptsPropsJson', scriptsPropsJson);

                    content = grunt.file.read(path.join(__dirname, i18nPropsForScriptsTemplateFile));
                    // Pretty print the JSON file format
                    scriptsPropsJson = JSON.stringify(scriptsPropsJson, null, 4);
                    scriptsPropsJson = scriptsPropsJson.replace(new RegExp(eol + _this.createSpace(4), "mg"), eol + _this.createSpace(8));
                    scriptsPropsJson = scriptsPropsJson.replace("}", _this.createSpace(4) + "}");

                    content = content.replace("{{i18nPropsJson}}", scriptsPropsJson);
                    grunt.file.write(destPath, content);
                    
                });
            },
            // Copy all the source dust template files to each targeted locale folder.
            copyTemplateFiles: function (options){

                var localesList = this.getLocalesList(),
                    templatesList = this.getTemplatesList(),
                    localesRootPath = options.localesRootPath;

                filesSrc.forEach(function(srcpath, idx) {
                    var destpath = '',
                        templatespath = srcpath.split(sep).slice(1).join(sep);

                    grunt.verbose.writeln('[precompile] ==== src template path: ', srcpath);

                    localesList.forEach(function(locale, idx) {
                        destpath = path.join(localesRootPath, locale, templatespath);

                        templatesList.push(destpath);

                        grunt.file.copy(srcpath, destpath, {
                            noProcess: false
                        });

                    });

                });
            },
            /*
            ** Handle the {@i18n} tag in each dust template file in each locale, replace it with associated localized properties file
            ** Or show the missing key error message if the key is missing
            */
            generateLocalizedTemplates: function (options){

                var _this = this,
                    localesRootPath = options.localesRootPath,
                    templatesList = this.getTemplatesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList();

                // grunt.log.writeln('=========templatesList', templatesList);
                templatesList.map(function(filepath){
                    var dustFilePath = filepath,
                        dustFileContent = grunt.file.read(dustFilePath),
                        propsFilePath = dustFilePath.replace(dustRegExp, '.properties'),
                        isPropsExists = grunt.file.exists(propsFilePath),
                        propsJSON = isPropsExists ? _this.convertPropsToJson(grunt.file.read(propsFilePath)) : {};

                    return {
                        dustFilePath: dustFilePath,
                        dustFileContent: dustFileContent,
                        propsFilePath: propsFilePath,
                        propsJSON: propsJSON
                    };

                }).forEach(function(obj, idx){
                    var content = obj.dustFileContent,
                        dustFilePath = obj.dustFilePath,
                        propsJSON = obj.propsJSON,
                        propsFilePath = obj.propsFilePath,
                        isI18nExists = false,
                        isCommonKey = false,
                        localizedText = '',
                        locale = _this.getLocaleFromFilePath(dustFilePath, localesRootPath),
                        commonPropsJson = {},
                        ret = '';
                    
                    commonPropsJsonList.forEach(function(obj){
                        if(obj[locale]){
                          commonPropsJson = obj[locale];
                        }
                    });  
                    /*
                    ** Though we can use the RegExp object's exec or String.prototype.match method, 
                    ** however the String.prototype.replace method is much easier and flexible to generate the resouce bundle file
                    ** no matter this file format is a JAVA property or JSON file
                    */
                    ret = content.replace(i18nRegExp, function(match, key, value, offset, origStr){

                        if(!isI18nExists){
                            isI18nExists = true;
                        }
                        
                        // Fetch the localized message associated with this key, firstly search in the associated dust template
                        // if not found, then search it in the common properties files, if still not found then abort the grunt task.
                        localizedText = propsJSON[key];
                        
                        if(_this.isEmpty(localizedText)){

                            localizedText = commonPropsJson[key];
                            
                            if(_this.isEmpty(localizedText)){
                                grunt.fail.fatal('[[ missing key: ' + (key).bold + ' ]] in file - ' + (dustFilePath).bold);
                            }
                            else{
                                grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                            }
                        }
                        else{
                            grunt.verbose.writeln('[precompile] ==== this key [[' + (key).blue + ']] has been found in locale [[ ' + (locale).yellow + ' ]]');
                        }
                        
                        return localizedText;
                    });

                    if(isI18nExists){
                        grunt.log.writeln('[precompile] ==== this file has i18n tag: ', dustFilePath);
                        grunt.file.write(dustFilePath, ret);
                    }
                });
            },

            start: function (options){
                this.generateScriptsProps(options);
                this.copyTemplateFiles(options);
                this.generateLocalizedTemplates(options);
            }

        };

        // Initialize all of the variable values
        util.init(options);
        util.start(options);

    });

};
