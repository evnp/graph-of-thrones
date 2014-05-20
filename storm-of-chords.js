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

  var $modules = $('#modules'),
      $months = $('#months'),
      $years = $('#years'),
      $includeSolo  = $('#include_solo');

  // Set initial states for filters
  $modules.attr('data-choice-type', 'module')
    .children('option[value="13"], option[value="14"], option[value="15"]')
    .prop('selected', true);
  $months.attr('data-choice-type', 'month');
  $years.attr('data-choice-type', 'year')
    .children('option[value="2014"]').prop('selected', true);

  // Control value getter functions
  function getModulesVal() { return ($modules.val() || []).map(parseFloat); }
  function getMonthsVal() { return ($months.val() || []).map(function (month) { return parseFloat(month) + 1; }); }
  function getYearsVal() { return ($years.val() || []).map(function (month) { return parseFloat(month) % 100; }); }
  function getIncludeSoloVal() { return $includeSolo.prop('checked'); }

  // Variables representing the current state of filters
  var modules     = getModulesVal(),
      months      = getMonthsVal(),
      years       = getYearsVal(),
      includeSolo = getIncludeSoloVal();

  // When control changes, update corresponding filter state and rebuild graph
  $modules.change(function () {
    modules = getModulesVal();
    filterAndRebuild(modules, includeSolo);
  });
  $months.change(function () {
    months = getMonthsVal();
    filterAndRebuild();
  })
  $years.change(function () {
    years = getYearsVal();
    filterAndRebuild();
  })
  $includeSolo.change(function () {
    includeSolo = getIncludeSoloVal();
    filterAndRebuild();
  });

  function filterscene(scene, characterId) {
    return modules.indexOf(scene.module) !== -1
       && (months.length === 0 || months.indexOf(parseFloat(scene.date.slice(0, 2))) !== -1)
       && (years.length === 0 || years.indexOf(parseFloat(scene.date.slice(-2))) !== -1)
       && (includeSolo || parseFloat(characterId) !== parseFloat(scene.partner));
  }

  // Build initial graph from data file
  var sceneMap, characterMap;
  d3.json('character_data.json', function(data) {
    sceneMap = data.scene_data;
    characterMap = data.character_data;
    filterAndRebuild();
  });

  // Filter scenes against the current filter state and rebuild the graph
  function filterAndRebuild() {

    // Store characters in array and create map of ids -> indices
    // - filter out characters that don't have scenes passing filterscene
    var characters = [], idToIndexMap = {};
    _.each(characterMap, function(character, id) {
      if (_.any(sceneMap[id], function (scene) { return filterscene(scene, id); })) {
        character.id = id;
        characters.push(character)
        idToIndexMap[id] = characters.length - 1;
      }
    });

    console.log(characters)

    // Construct a square matrix counting scene partnerships.
    var matrix = [];
    _.each(characters, function(character) {
      var row = [];
      for (var j = 0; j < characters.length; j++) { row.push(0); }

      _.each(sceneMap[character.id], function(scene) {
        if (filterscene(scene, character.id)) {
          row[idToIndexMap[scene.partner]]++;
        }
      });

      matrix.push(row);
    });

    console.log(matrix);

    function setColor(el, n) {
      d3.select(el)
        .style('stroke', d3.rgb(fill(n)).darker())
        .style('fill', fill(n));
    }

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
      .style('opacity', 0)
      .transition()
      .duration(transitionDuration)
        .style('opacity', 1);

    var newArcs = newGroups.append('path')
      .each(function(d) { setColor(this, d.index); });

    var newLabels = newGroups.append('text')
      .text(function(d) { return characters[d.index].name; });

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
      return d3.range(0, d.value, 1).map(function(v, i) {
        return {
          angle: v * k + d.startAngle,
          label: i % 5 ? null : v / 1000 + "k"
        };
      });
    }
  }

}(jQuery, _, d3));
