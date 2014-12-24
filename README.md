# grunt-sh-precompile

> Grunt plugin for precompile dust template specific to Stubhub

## Getting Started
This plugin requires Grunt `~0.4.5`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-sh-precompile --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-sh-precompile');
```

## The "sh_precompile" task

### Overview
In your project's Gruntfile, add a section named `sh_precompile` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  sh_precompile: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

### Options

#### options.localesRootPath
Type: `String`
Default value: no default value, this config option is required

A string value, normally it should point to where the i18n/locale folder in the deployment build environment, this value will be like **build-dev/resources/shape/i18n**.

#### options.implementedLocalesList
Type: `Array`
Default value: no default value, this config option is required

It specify the implemented locales list for current application.

#### options.commonPropsSrc
Type: `Array`
Default value: `['common/**/*.properties']`

It specify where is the common properties file locate, it should be relative to the locale's folder. Normally, this value should not be changed just accept the default value is enough.

#### options.scriptsPropsSrc
Type: `Array`
Default value: `['common/**/*.properties']`

It specify where is the scripts properties file locate, it also should be relative to the locale's folder. Normally, this value should not be changed just accept the default value is enough.

#### options.scriptsPropsFileName
Type: `Array`
Default value: `'i18nPropsForScripts'`

It specify the generated javascript properties file name.

#### options.getTemplateFilePath
Type: `Function`
Returned value type: `String`

It return the template file path in deployment folder structure, make sure the returned template file path should be in the same folder with the associated properties file like below:

```javascript
build-dev/resources/shape/<appName>/i18n/<locale>/tempaltes/
                                                           --header.poperties
                                                           --header.dust
 ```

The key point in this example is **the dust template file must be put together with the properties file in the same folder**.

#### options.getScriptsPropsFilePath
Type: `Function`
Returned value type: `String`

It return the generated javascript properties file path in deployment folder structure. Normally this is not recommended to use.

#### options.getLocaleFromFilePath
Type: `Function`
Returned value type: `String`

It return the locale value from the template file path. Normally this is not recommended to use.

### Usage Examples

#### Custom Options
The exmaple below is coming from `https://github.corp.ebay.com/rchavan/app-sellflow/tree/selli18n`.

```js
meventdev: {
    options: {
        localesRootPath: '<%= buildDevPath %><%= multiFeatureI18nPath %>',
        implementedLocalesList: ['en-us', 'en-gb'],
        commonPropsSrc: ['common/**/*.properties'],
        scriptsPropsSrc: ['scripts/**/*.properties'],
        scriptsPropsFileName: '<%= scriptsPropsFileName %>',
        getTemplateFilePath: function (settings){
            var localesRootPath = settings.localesRootPath,
                locale = settings.locale,
                filepath = settings.filepath,
                templatespath = '',
                destpath = '';
            
            templatespath = filepath.split(sep).slice(2).join(sep);
            destpath = path.join(localesRootPath, locale, templatespath);

            return destpath;
        }
    },
    src: ['app/multi-event/templates/**/*.dust']
}
```

And here is another exmaple which is coming from `https://github.corp.ebay.com/rchavan/app-sellflow/tree/selli18n`.

```js
dev:{
    options:{
        implementedLocalesList: ['en-us', 'en-gb', 'de-de'],
        localesRootPath: '<%= buildDevPath %><%= localesRootPath %>',
        commonPropsSrc: ['common/**/*.properties'],
        scriptsPropsSrc: ['scripts/**/*.properties'],
        scriptsPropsFileName: '<%= scriptsPropsFileName %>'
    },
    src: ['app/templates/**/*.dust']
}
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
