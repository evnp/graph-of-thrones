var ChordDiagram = (function (d3, _) {

  d3.selection.prototype.moveToFront = function() {
    return this.each(function(){
    this.parentNode.appendChild(this);
    });
  };

  var defaults = {
    diameter: 800, // px
    arcWidth: 130, // px
    transitionDuration: 500, // ms
    colorScale: d3.scale.category20b() // 20-color ordinal scale
  };

  function valueOrDefault(options, key) {
    return options.hasOwnProperty(key) ? options[key] : defaults[key];
  }

  function Diagram(container, options) {
    options.diameter = valueOrDefault(options, 'diameter');
    options.arcWidth = valueOrDefault(options, 'arcWidth');

    this.outerRadius = options.diameter / 2;
    this.innerRadius = outerRadius - options.arcWidth;

    this.colorScale         = valueOrDefault(options, 'colorScale');
    this.transitionDuration = valueOrDefault(options, 'transitionDuration');

    this.svg = d3.select(container).append('svg')
      .attr('width', this.outerRadius * 2)
      .attr('height', this.outerRadius * 2)
      .append('g')
        .attr('transform', 'translate(' + outerRadius + ',' + outerRadius + ')');

    this.chordLayout = d3.layout.chord()
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    this.arc = d3.svg.arc()
      .innerRadius(innerRadius)
      .outerRadius(innerRadius + 20);

    // Used to keep track of arc elements so they can be referenced via chords
    this.arcElements = [];
  }

  Diagram.prototype.render = function (matrix, nameArray) {
    var diagram = this;

    // Set color scale domain for new data
    this.colorScale.domain(0, nameArray.length);

    function setColor(d) {
      var color = diagram.colorScale(d.index);
      d3.select(this)
        .style('stroke', d3.rgb(color).darker())
        .style('fill', color);
    }

    // Generate new layout for given matrix
    this.chordLayout.matrix(matrix);


    /*** Update rendered arc set ***/

    var arcs = svg.selectAll('.arcs').data(this.chordLayout.groups);

    // Transition out obsolete arcs
    arcs.exit()
      .style('opacity', 1)
      .transition()
      .duration(this.transitionDuration)
        .style('opacity', 0)
      .remove();

    // Transition in new arcs
    var newArcs = arcs.enter().append('g')
      .attr('class', 'arc')
      .style('opacity', 0)
      .transition()
      .duration(transitionDuration)
        .style('opacity', 1);

    // Create new arc paths and labels
    var newArcPaths = newArcs.append('path').each(setColor);
    var newArcLabels = newArcs.append('text')
      .text(function (d) { return nameArray[d.index]; })
      .style('fill', function (d) { return d3.rgb(diagram.colorScale(d.index).darker(); });

    // Transition arc paths into new positions
    arcs.select('path').transition()
      .duration(this.transitionDuration)
      .attr('d', this.arc);

    // Transition arc labels into new positions
    arcs.select('text').transition()
      .duration(this.transitionDuration)
      .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .style('text-anchor', function(d) { return d.angle > Math.PI ? 'end' : null; })
      .attr('transform', function(d) {
        return 'rotate(' + (d.angle * 180 / Math.PI - 90) + ')'
            + 'translate(' + (innerRadius + 26) + ')'
            + (d.angle > Math.PI ? 'rotate(180)' : '');
      });

    // Reset arc ticks
    arcs.selectAll('.tick').remove();
    arcs.append("g").selectAll("g").data(function (d) {
      var k = (d.endAngle - d.startAngle) / d.value;
      return d3.range(0, d.value, 5).map(function(v, i) {
        return {
          angle: v * k + d.startAngle,
          label: i % 5 ? null : v / 1000 + "k"
        };
      });
    }).enter().append("g")
      .attr('class', 'tick')
      .attr("transform", function(d) {
        return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
            + "translate(" + diagram.innerRadius + ",0)";
      }).append("line")
        .attr("x1", 6)
        .attr("y1", 0)
        .attr("x2", 13)
        .attr("y2", 0)
        .style("stroke", "#fff")
        .style('opacity', 0)
        .transition()
          .delay(this.transitionDuration)
          .duration(this.transitionDuration)
          .style('opacity', 1);


    /*** Update rendered chord set ***/

    var chords = svg.selectAll('.chord').data(this.chordLayout.chords);

    // Transition out obsolete chords
    chords.exit()
      .style('opacity', 1)
      .transition()
      .duration(this.transitionDuration)
        .style('opacity', 0)
      .remove();

    // Create new chords as needed
    chords.enter().append('path')
      .attr('class', 'chord')
      .each(function(d) { setColor.call(this, d.source); })
      .style('opacity', 0);

    // Transition chords into new positions
    chords.transition()
      .duration(this.transitionDuration)
      .style('opacity', 1)
      .attr('d', d3.svg.chord().radius(this.innerRadius));


    /*** Chord and Arc Events  ***/

    // Collect arc elements so they can be referenced via chords
    this.arcElements = [];
    arcs.each(function (d, i) { diagram.arcElements[i] = this; });

    newArcs
      .on('mouseenter', function (arc) { diagram.highlightChordsForArc(arc); })
      .on('mouseout', function () { diagram.unhighlightAll(); });

    newChords
      .on('mouseenter', function (chord) { diagram.highlightChord(chord); })
      .on('mouseout', function (chord) { diagram.unhighlightChord(chord); });


    /*** Return new elements for event registration ***/

    return {
      newArcs: newArcs,
      newChords: newChords
    };
  };

  Diagram.prototype.highlightChordsForArc = function (arc) {
    var diagram = this;

    svg.classed('fade-arcs', true);
    svg.classed('fade-chords', true);
    d3.select(this.arcElements[arc.index]).classed('highlighted', true);

    chords.classed('highlighted', function (chord) {
      return chord.source.index === arc.index || chord.target.index === arc.index;
    }).each(function (chord) {
      if (chord.source.index === arc.index) {
        setColor.call(this, chord.target);
        d3.select(diagram.arcElements[chord.target.index]).classed('highlighted', true);
      } else if (chord.target.index === arc.index) {
        setColor.call(this, chord.source);
        d3.select(diagram.arcElements[chord.source.index]).classed('highlighted', true);
      }
    });
  };

  Diagram.prototype.unhighlightAll = function () {
    this.svg.classed('fade-arcs', false);
    this.svg.classed('fade-chords', false);
    this.chords.classed('highlighted', false);
    this.arcs.classed('highlighted', false);
  };

  Diagram.prototype.highlightChord = function (chord) {
    this.toggleChordHighlight(chord, true);
  };

  Diagram.prototype.unhighlightChord = function (chord) {
    this.toggleChordHighlight(chord, false);
  };

  Diagram.prototype.toggleChordHighlight = function (chord, toggle) {
    this.svg.classed('fade-arcs', toggle);
    d3.select(this.arcElements[chord.source.index]).classed('highlighted', toggle);
    d3.select(this.arcElements[chord.target.index]).classed('highlighted', toggle);
    d3.select(chord.element).moveToFront();
  };



})(d3, _);

