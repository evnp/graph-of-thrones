(function ($, _, d3) {

  d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
    this.parentNode.appendChild(this);
    });
  };

  var outerRadius = 800 / 2,
      innerRadius = outerRadius - 130;

  var fill = d3.scale.category20c();

  var transitionDuration = 500;

  var arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(innerRadius + 20);

  var svg = d3.select('#chart-container').append('svg')
      .attr('width', outerRadius * 2)
      .attr('height', outerRadius * 2)
    .append('g')
      .attr('transform', 'translate(' + outerRadius + ',' + outerRadius + ')');

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
    });
    _.each(chapterMap, function (chapter, url) {
      _.each(chapter.characterNames, function (name) {
        characterMap[name].chapterUrls.push(url);
      });
    });

    rebuild();
  });

  function rebuild() {
    var nameList = _.pluck(getFilteredCharacters(), 'name'),
        matrix = generateMatrix(nameList);
    render(matrix, nameList);
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
  function generateMatrix(characterNameList) {
    var nameToIndexMap = getKeyToIndexMap(characterNameList),
        filteredChapters =
        size = characterNameList.length;

    var matrix = _.map(characterNameList, function(rowName) {

      // create a row prefilled with zeroes
      var row = []; for (var j = 0; j < size; j++) { row.push(0); }
      var filteredChapterUrls = _(characterMap[rowName].chapterUrls).filter(chapterFilter);

      filteredChapterUrls.each(function(chapterUrl) {
        _.each(chapterMap[chapterUrl].characterNames, function (colName) {
          if (colName != rowName) { // avoid counting the same character with themselves as a pair
            row[nameToIndexMap[colName]]++;
          }
        });
      });

      return row;
    });

    return matrix;
  }

  function render(matrix, nameList) {
    var chord = d3.layout.chord()
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    chord.matrix(matrix);

    var groups = svg.selectAll('.group').data(chord.groups);

    groups.exit()
      .style('opacity', 1)
      .transition()
      .duration(transitionDuration)
        .style('opacity', 0)
      .remove();

    var newGroups = groups.enter().append('g')
      .attr('class', 'group');

    newGroups
      .attr('data-character', function(d) { return nameList[d.index]; })
      .style('opacity', 0)
      .transition()
      .duration(transitionDuration)
        .style('opacity', 1);

    var newArcs = newGroups.append('path')
      .each(function(d) { setColor(this, d.index); });

    var newLabels = newGroups.append('text')
      .text(function(d) { return nameList[d.index]; });

    groups.select('path')
      .transition()
      .duration(transitionDuration)
        .attr('d', arc);

    groups.select('text')
      .transition()
      .duration(transitionDuration)
        .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '.35em')
        .attr('transform', function(d) {
          return 'rotate(' + (d.angle * 180 / Math.PI - 90) + ')'
              + 'translate(' + (innerRadius + 26) + ')'
              + (d.angle > Math.PI ? 'rotate(180)' : '');
        })
        .style('text-anchor', function(d) { return d.angle > Math.PI ? 'end' : null; })

    // Reset ticks
    groups.selectAll('.tick').remove();
    groups.append("g").selectAll("g")
        .data(groupTicks)
      .enter().append("g")
        .attr('class', 'tick')
        .attr("transform", function(d) {
          return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
              + "translate(" + innerRadius + ",0)";
        })
        .append("line")
          .attr("x1", 6)
          .attr("y1", 0)
          .attr("x2", 13)
          .attr("y2", 0)
          .style("stroke", "#fff")
          .style('opacity', 0)
          .transition()
          .delay(transitionDuration)
          .duration(400)
            .style('opacity', 1);

    var chords = svg.selectAll('.chord').data(chord.chords);

    chords.exit()
      .style('opacity', 1)
      .transition()
      .duration(transitionDuration)
        .style('opacity', 0)
      .remove();

    var newChords = chords.enter().append('path')
      .attr('class', 'chord')
      .each(function(d) { setColor(this, d.source.index); })
      .style('opacity', 0);

    chords
      .transition()
      .duration(transitionDuration)
        .style('opacity', 1)
        .attr('d', d3.svg.chord().radius(innerRadius));

    /*** Chord and Arc Events  ***/

    // Collect group elements so they can be referenced via chords
    var groupElements = [];
    groups.each(function (d, i) { groupElements[i] = this; });

    groups
      .on('mouseover', null) // Clear out old events
      .on('mouseout', null)
      .on('mouseover', function (d, i) {
        svg.classed('fade-groups', true);
        svg.classed('fade-chords', true);
        d3.select(groupElements[i]).classed('highlighted', true);

        chords.classed('highlighted', function (d) {
          if (d.source.index === i) {
            setColor(this, d.target.index);
            d3.select(groupElements[d.target.index]).classed('highlighted', true);
            return true;

          } else if (d.target.index === i) {
            setColor(this, d.source.index);
            d3.select(groupElements[d.source.index]).classed('highlighted', true);
            return true;
          }

          return false;
        });
      })
      .on('mouseout', function (d) {
        svg.classed('fade-groups', false);
        svg.classed('fade-chords', false);
        chords.classed('highlighted', false);
        d3.selectAll(groupElements).classed('highlighted', false);
      });

    chords
      .on('mouseover', null) // Clear out old events
      .on('mouseout', null)
      .on('mouseover', function (d) {
        svg.classed('fade-groups', true);
        d3.select(groupElements[d.source.index]).classed('highlighted', true);
        d3.select(groupElements[d.target.index]).classed('highlighted', true);
        d3.select(this).moveToFront();
      })
      .on('mouseout', function (d) {
        svg.classed('fade-groups', false);
        d3.select(groupElements[d.source.index]).classed('highlighted', false);
        d3.select(groupElements[d.target.index]).classed('highlighted', false);
      });

    // Returns an array of tick angles and labels, given a group.
    function groupTicks(d) {
      var k = (d.endAngle - d.startAngle) / d.value;
      return d3.range(0, d.value, 10).map(function(v, i) {
        return {
          angle: v * k + d.startAngle,
          label: i % 5 ? null : v / 1000 + "k"
        };
      });
    }
  }

  /*** Character Info ***/

  $('#chart-container').on('mouseenter', 'svg .group', function () {
    var $info = $('#info-container'),
      characterName = $(this).data('character'),
      characterData = characterMap[characterName],
      characterColor = $(this).children('path').css('fill');

    if (characterData) {
      $info.find('.info').each(function () {
        var $el = $(this),
            key = $el.data('info-key'),
           data = characterData[key];

        if (!data) { // If no data, don't show the element
          $el.hide();
        } else if ($el.hasClass('url')) { // Special case for url data
          $el.show().attr('href', data);
        } else if ($el.hasClass('text')) { // If el is text element, set text
          $el.show().text(data);
        } else { // Otherwise, see if a child is text element and set text
          var children = $el.find('.text');
          if (children.length) { children.text(data); }
          $el.show();
        }
      });

      $info.find('a').css('color', characterColor)

      $info.show();
    } else {
      $info.hide();
    }
  });

  /*** Helper Functions ***/

  function setColor(el, n) {
    d3.select(el)
      .style('stroke', d3.rgb(fill(n)).darker())
      .style('fill', fill(n));
  }

  function getKeyToIndexMap(keyArray) {
    var i = 0, map = {};
    _.each(keyArray, function (key) { map[key] = i++; });
    return map;
  }

}(jQuery, _, d3));
