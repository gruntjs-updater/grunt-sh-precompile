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
            _ = require('underscore'),
            parser = require('properties-parser'), // Please refer to https://github.com/xavi-/node-properties-parser
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

            isEmpty: function(val){
                return (typeof val === 'undefined') || val === null;
            },

            createSpace: function(num){
                // Default create 4 spaces
                num = (num || 4) + 1;
                return new Array(num).join(' ');
            },

            convertJson: function (json){
                var obj = {},
                    _this = this;

                _.each(json, function (val, key, list){
                    obj[key] = _this._convertStringIfBooleanOrNumber(val);
                });

                return obj;
            },

            _convertStringIfBooleanOrNumber: function (original) {
                if (original && _.isString(original)) {
                    if (original === "true") {
                        return true;
                    }
                    if (original === "false"){
                        return false;
                    }
                    try {
                        if (this._isNumeric(original)) {
                            return parseFloat(original);
                        }
                        return original;
                    }
                    catch (e){
                        return original;
                    }
                }
                else {
                    return original;
                }
            },

            // http://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
            // http://rosettacode.org/wiki/Determine_if_a_string_is_numeric#JavaScript
            _isNumeric: function (n) {
                return !isNaN(parseFloat(n)) && isFinite(n);
            },

            getLocaleFromFilePath: function(filePath, localesRootPath){
                var locale = '';

                filePath = path.normalize(filePath);
                locale = _.find(this.localesList, function (val, idx, list){
                    return filePath.indexOf(sep + val + sep) > 0;
                });

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
                    implementedLocalesList = options.implementedLocalesList,
                    localesList = this.getLocalesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList(),
                    scriptsPropsJsonList = this.getScriptsPropsJsonList();

                grunt.verbose.writeln('============localesRootPath=======', localesRootPath);

                // Fetch all the actually implemented locales list, 
                // will ignore the implemented locales specified in implementedLocalesList config option if this locale actually is not implemented
                fs.readdirSync(localesRootPath).forEach(function(locale){
                    locale = _this.getNormalizedLocale(locale);
                    locale = locale.toLowerCase();
                    
                    if(_.contains(implementedLocalesList, locale)){
                        localesList.push(locale);
                    }

                });

                _.each(localesList, function(locale, idx, list){
                    var commonLocalePropsSrc = [],
                        commonPropsFileArr = [],
                        commonLocalePropsJson = {},
                        commonPropsJson = {},
                        scriptsLocalePropsSrc = [],
                        scriptsPropsFileArr = [],
                        scriptsLocalePropsJson = {},
                        scriptsPropsJson = {};

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
                        var jsonObj = grunt.file.exists(file) ? parser.read(file) : {};
                        jsonObj = _this.convertJson(jsonObj);
                        commonLocalePropsJson = _.extend({}, commonLocalePropsJson, jsonObj);
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
                        var jsonObj = grunt.file.exists(file) ? parser.read(file) : {};
                        jsonObj = _this.convertJson(jsonObj);
                        scriptsLocalePropsJson = _.extend({}, scriptsLocalePropsJson, jsonObj);
                    });

                    scriptsPropsJson[locale] = scriptsLocalePropsJson;
                    scriptsPropsJsonList.push(scriptsPropsJson);
                });

                grunt.log.writeln(('[precompile] ==== available locale list is: ').bold.blue, localesList);
                grunt.log.writeln(('[precompile] ==== commonPropsJsonList is: ').bold.blue, commonPropsJsonList);
                grunt.log.writeln(('[precompile] ==== scriptsPropsJsonList is: ').bold.blue, scriptsPropsJsonList);

            },
            // Combile commonPropsJson with scriptsPropsJson to generate a new sripts properties for each locale
            generateScriptsProps: function (options){

                var localesRootPath = options.localesRootPath,
                    scriptsPropsFileName = options.scriptsPropsFileName,
                    localesList = this.getLocalesList(),
                    commonPropsJsonList = this.getCommonPropsJsonList(),
                    scriptsPropsJsonList = this.getScriptsPropsJsonList(),
                    getScriptsPropsFilePath = options.getScriptsPropsFilePath,
                    _this = this;

                localesList.forEach(function(locale, idx){
                    var commonPropsJson = {},
                        scriptsPropsJson = {},
                        content = '',
                        destPath = '';

                    destPath = getScriptsPropsFilePath({
                        localesRootPath: localesRootPath,
                        locale: locale,
                        scriptsPropsFileName: scriptsPropsFileName
                    });

                    _.some(commonPropsJsonList, function (obj, idx, list){
                        if(obj[locale]){
                            commonPropsJson = obj[locale];
                            return true;
                        }
                    });

                    _.some(scriptsPropsJsonList, function (obj, idx, list){
                        if(obj[locale]){
                            scriptsPropsJson = obj[locale];
                            return true;
                        }
                    });

                    scriptsPropsJson = _.extend({}, commonPropsJson, scriptsPropsJson);
                    
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
                    localesRootPath = options.localesRootPath,
                    getTemplateFilePath = options.getTemplateFilePath,
                    _this = this;

                filesSrc.forEach(function(srcpath, idx) {
                    // this code line: srcpath = path.normalize(srcpath)
                    // fix the issue on Windows Platform, since on windows git bash, the srcpath and sep value will be like below
                    //
                    // srcpath:  app/templates/footer.dust
                    // sep    :  \
                    // 
                    // so firslty need to normalize the file path
                    var destpath = '',
                        templatespath = '';

                    srcpath = path.normalize(srcpath);
                    templatespath = srcpath.split(sep).slice(1).join(sep);

                    grunt.verbose.writeln('[precompile] ==== src template path: ', srcpath);

                    localesList.forEach(function(locale, idx) {
                        
                        destpath = getTemplateFilePath({
                                localesRootPath: localesRootPath,
                                locale: locale,
                                filepath: srcpath
                        });
                        
                        grunt.verbose.writeln('[precompile] ==== src template path in deployment folder: ', destpath);

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
                        propsJSON = isPropsExists ? parser.read(propsFilePath) : {};

                    propsJSON = _this.convertJson(propsJSON);

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

                        grunt.verbose.writeln('[precompile] ==== replace key with localed value: ', {match: match, key: key, value: value, offset: offset, origStr: origStr});
                        
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
            },

            checkRequiredConfig: function (task){
                var requiredOptions = ['localesRootPath', 'implementedLocalesList', 'getTemplateFilePath', 'getScriptsPropsFilePath'];

                task.requiresConfig.apply(task, _.map(requiredOptions, function (val, idx, list){
                    return [task.name, task.target, 'options', val].join('.');
                }));
            }

        };

        // Before running this task, firstly make sure all required config options has been specified.
        util.checkRequiredConfig(this);

        // Initialize all of the variable values
        util.init(options);
        util.start(options);

    });

};
