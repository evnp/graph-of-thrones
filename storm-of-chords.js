(function ($, _, d3) {

  // Initialize Diagram
  var diagram = new ChordDiagram($('#chart-container').get(0));

  /*** Data Controls ***/

  // var $modules = $('#modules'),
  //     $months = $('#months'),
  //     $years = $('#years'),
  //     $includeSolo  = $('#include_solo');

  // // Set initial states for filters
  // $modules.attr('data-choice-type', 'module')
  //   .children('option[value="13"], option[value="14"], option[value="15"]')
  //   .prop('selected', true);
  // $months.attr('data-choice-type', 'month');
  // $years.attr('data-choice-type', 'year')
  //   .children('option[value="2014"]').prop('selected', true);

  // // Control value getter functions
  // function getModulesVal() { return ($modules.val() || []).map(parseFloat); }
  // function getMonthsVal() { return ($months.val() || []).map(function (month) { return parseFloat(month) + 1; }); }
  // function getYearsVal() { return ($years.val() || []).map(function (month) { return parseFloat(month) % 100; }); }
  // function getIncludeSoloVal() { return $includeSolo.prop('checked'); }

  // // Variables representing the current state of filters
  // var modules     = getModulesVal(),
  //     months      = getMonthsVal(),
  //     years       = getYearsVal(),
  //     includeSolo = getIncludeSoloVal();

  // // When control changes, update corresponding filter state and rebuild graph
  // $modules.change(function () {
  //   modules = getModulesVal();
  //   rebuild();
  // });
  // $months.change(function () {
  //   months = getMonthsVal();
  //   rebuild();
  // })
  // $years.change(function () {
  //   years = getYearsVal();
  //   rebuild();
  // })
  // $includeSolo.change(function () {
  //   includeSolo = getIncludeSoloVal();
  //   rebuild();
  // });

  var includeAppearances = true, includeActive = true, minAppearances = 15;

  var books, chapterMap, characterMap;

  // Build initial graph from data file
  d3.json('asoiaf_data.json', function(data) {
    books = _.sortBy(data.books, 'number');
    characterMap = data.characters;
    chapterMap = {};

    // Set up map of chapters keyed on chapter url
    _.each(books, function (book) {
      _.each(book.chapters, function (chapter) {
        chapter.book = book.number;
        chapterMap[chapter.url] = chapter;
      });
    });

    // Set up list of character names for each chapter
    _.each(chapterMap, function (chapter) {
      chapter.characterNames = _.union(
        includeAppearances ? chapter.appearances : [],
        includeActive      ? chapter.active      : []
      );
    });

    // Set up list of chapter urls for each character
    _.each(characterMap, function (character, name) {
      character.name = name;
      character.url = 'abc'; // Temp until urls are part of data
      character.chapterUrls = [];
      character.povChapterUrls = [];
    });
    _.each(chapterMap, function (chapter, url) {
      _.each(chapter.characterNames, function (name) {
        var character = characterMap[name];

        character.chapterUrls.push(url);
        if (chapter.pov === name) {
          character.povChapterUrls.push(url);
        }
      });
    });

    rebuild();
  });

  function rebuild() {
    var names = _.pluck(getFilteredCharacters(), 'name'),
        pairings = countPairings(names);

    render(pairings, names);
  }

  function chapterFilter(chapterUrl) {
    var chapter = chapterMap[chapterUrl];
    return true;
    //return modules.indexOf(chapter.module) !== -1
    //   && (months.length === 0 || months.indexOf(parseFloat(chapter.date.slice(0, 2))) !== -1)
    //   && (years.length === 0 || years.indexOf(parseFloat(chapter.date.slice(-2))) !== -1);
  }

  // Return an array of characters that appear in chapters passing chapterFilter
  function getFilteredCharacters() {
    return _.filter(characterMap, function (character) {
      return _.any(character.chapterUrls, chapterFilter) &&
             character.chapterUrls.length >= minAppearances;
    });
  }

  // Construct a square matrix containing counts of character pairings
  function countPairings(characterNameList) {
    var nameToIndexMap = getKeyToIndexMap(characterNameList),
        filteredChapters =
        size = characterNameList.length,
        chapterValues = {};

    var matrix = _.map(characterNameList, function(rowName) {

      // create a row prefilled with zeroes
      var row = []; for (var j = 0; j < size; j++) { row.push(0); }
      var filteredChapterUrls = _(characterMap[rowName].chapterUrls).filter(chapterFilter);

      filteredChapterUrls.each(function(chapterUrl) {
        var characterNames = chapterMap[chapterUrl].characterNames,
            chapterValue = chapterValues[chapterUrl];

        if (!chapterValue) {
          var chapterCast = _.filter(characterNames, function (name) {
            return characterNameList.indexOf(name) !== -1;
          });

          chapterValue = 1.5 * (1 / chapterCast.length);
          chapterValues[chapterUrl] = chapterValue;
        }

        _.each(characterNames, function (colName) {
          var characterIndex = nameToIndexMap[colName];

          if (colName != rowName) { // avoid counting the same character with themselves as a pair
            if (characterIndex || characterIndex === 0) {
              row[characterIndex] += chapterValue;
            }
          }
        });
      });

      return row;
    });

    return matrix;
  }

  function render(pairings, names) {

    var newSelections = diagram.render(pairings, names),
        newArcs   = newSelections.newArcs,
        newChords = newSelections.newChords;

    newArcs
      .on('mouseenter', setCharacterInfo)
      .attr('data-character', function (d) { return names[d.index]; })
      .each(function (d) { characterMap[names[d.index]].arc = d; })
  }


  /*** Character Info ***/

  var $info = $('#info-container');

  function setCharacterInfo(arc) {
    var pairings = diagram.matrix,
        names    = diagram.names;

    var charName  = names[arc.index],
      charData    = characterMap[charName],
      color       = $(this).children('path').css('fill'),
      numChapters = charData.chapterUrls.length,
      numPov      = charData.povChapterUrls.length;

    var associates  = _(pairings[arc.index])
      .map(function (numPairings, i) {
        return { name: names[i], numPairings: numPairings };
      })
      .filter('numPairings')
      .sortBy('numPairings')
      .reverse() // order desc
      .pluck('name')
      .value();

    $info.find('.info').each(function () {
      var $el = $(this),
          key = $el.data('info-key'),
        value = charData[key];

      if (!value) { // If no value, don't show the element
        $el.hide();
      } else if ($el.hasClass('url')) { // Special case for url data
        $el.show().attr('href', value);
      } else if ($el.hasClass('text')) { // If el is text element, set text
        $el.show().text(value);
      } else { // Otherwise, see if a child is text element and set text
        var children = $el.find('.text');
        if (children.length) { children.text(value); }
        $el.show();
      }
    });

    $info.find('a').css('color', color);

    $info.find('.activity').html(
      '<h3>Activity</h3>'+
      '<p>'+ numChapters +' chapters'+
            (numPov ? ' ('+ numPov +' pov)' : '')
           +', with'+
      '</p>'+
      '<ul>'+ _.map(associates.slice(0, 10), getCharacterListEl).join('') +'</ul>'+
      (associates.length <= 10 ? '' : '<p>and '+ (associates.length - 10) + ' others</p>')
    );

    $info.show();

    function getCharacterListEl(name) {
      var character = characterMap[name],
        color = d3.rgb(diagram.colorScale(names.indexOf(character.name))).darker();

      if (character) {
        return '<li>'+
          '<a style="color: '+ color +'" href="'+ character.url +'">'+
            character.name +
          '</a>'+
        '</li>';
      } else {
        return '<li>' + name + '</li>';
      }
    }
  }


  /*** Character Info Activity List ***/

  var $activity = $('#info-container .activity');

  $activity.off('mouseenter');
  $activity.on('mouseenter', 'li a', function () {
    var name = $(this).text();
    diagram.highlightChordsForArc(characterMap[name].arc);
  });

  $activity.off('mouseout');
  $activity.on('mouseout', 'li a', function () {
    diagram.unhighlightAll();
  });


  /*** Helper Functions ***/

  function getKeyToIndexMap(keyArray) {
    var i = 0, map = {};
    _.each(keyArray, function (key) { map[key] = i++; });
    return map;
  }

}(jQuery, _, d3));
