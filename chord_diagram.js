var ChordDiagram = (function (d3, _) {

  /*** D3 Helper Functions ***/

  // Set fill and stroke (darker) color for a selection, via provided getColor function
  d3.selection.prototype.setColor = function (getColor, noStroke) {
    this.style('fill', function (d) { return getColor.call(this, d); });
    !noStroke && this.style('stroke', function (d) { return d3.rgb(getColor.call(this, d)).darker(); });
    return this;
  }

  d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this);
    });
  };

  /*** Diagram Defaults ***/

  var defaults = {
    diameter: 800, // px
    arcWidth: 130, // px
    transitionDuration: 500, // ms
    colorScale: d3.scale.category20b() // 20-color ordinal scale
  };

  function valueOrDefault(options, key) {
    return options.hasOwnProperty(key) ? options[key] : defaults[key];
  }

  /*** Diagram Constructor ***/

  function Diagram(container, options) {
    options = options || {};

    options.diameter = valueOrDefault(options, 'diameter');
    options.arcWidth = valueOrDefault(options, 'arcWidth');
    options.colorScale = valueOrDefault(options, 'colorScale');
    options.transitionDuration = valueOrDefault(options, 'transitionDuration');

    this.outerRadius = options.diameter / 2;
    this.innerRadius = this.outerRadius - options.arcWidth;
    this.colorScale  = options.colorScale;
    this.transitionDuration = options.transitionDuration;


    this.svg = d3.select(container).append('svg')
      .attr('width', this.outerRadius * 2)
      .attr('height', this.outerRadius * 2)
      .append('g')
        .attr('transform', 'translate(' + this.outerRadius + ',' + this.outerRadius + ')');

    this.chordLayout = d3.layout.chord()
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    this.arc = d3.svg.arc()
      .innerRadius(this.innerRadius)
      .outerRadius(this.innerRadius + 20);

    // Used to keep track of arc elements so they can be referenced via chords
    this.arcElements = [];
  }

  Diagram.prototype.render = function (matrix, names) {
    var diagram = this;

    this.names  = names;
    this.matrix = matrix;

    // Set color scale domain for new data
    this.colorScale.domain(0, names.length);

    // Generate new layout for given matrix
    this.chordLayout.matrix(matrix);

    /*** Update rendered arc set ***/

    this.arcs = this.svg.selectAll('.arc').data(this.chordLayout.groups);

    // Transition out obsolete arcs
    this.arcs.exit()
      .style('opacity', 1)
      .transition()
      .duration(this.transitionDuration)
        .style('opacity', 0)
      .remove();

    // Transition in new arcs
    var newArcs = this.arcs.enter().append('g');

    newArcs
      .attr('class', 'arc')
      .style('opacity', 0)
      .transition()
        .duration(this.transitionDuration)
        .style('opacity', 1);

    // Create new arc paths and labels
    newArcs.append('path');
    newArcs.append('text');

    // Set arc path and text colors using new color scale domain
    function getColor(d) { return diagram.colorScale(d.index); }
    this.arcs.selectAll('path').setColor(getColor);
    this.arcs.selectAll('text')
      .setColor(function (d) { return d3.rgb(getColor(d)).darker(); }, true)
      .text(function (d) { return names[d.index]; });

    // Transition arc paths into new positions
    this.arcs.select('path').transition()
      .duration(this.transitionDuration)
      .attr('d', this.arc);

    // Transition arc labels into new positions
    this.arcs.select('text').transition()
      .duration(this.transitionDuration)
      .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr('dy', '.35em')
      .style('text-anchor', function(d) { return d.angle > Math.PI ? 'end' : null; })
      .attr('transform', function(d) {
        return 'rotate(' + (d.angle * 180 / Math.PI - 90) + ')'
            + 'translate(' + (diagram.innerRadius + 26) + ')'
            + (d.angle > Math.PI ? 'rotate(180)' : '');
      });

    // Reset arc ticks
    this.arcs.selectAll('.tick').remove();
    this.arcs.append("g").selectAll("g").data(function (d) {
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

    this.chords = this.svg.selectAll('.chord').data(this.chordLayout.chords);

    // Transition out obsolete chords
    this.chords.exit()
      .style('opacity', 1)
      .transition()
      .duration(this.transitionDuration)
        .style('opacity', 0)
      .remove();

    // Create new chords as needed
    var newChords = this.chords.enter().append('path');

    newChords
      .attr('class', 'chord')
      .setColor(function (d) { return diagram.colorScale(d.source.index); })
      .style('opacity', 0);

    // Transition chords into new positions
    this.chords.transition()
      .duration(this.transitionDuration)
      .style('opacity', 1)
      .attr('d', d3.svg.chord().radius(this.innerRadius));


    /*** Chord and Arc Events  ***/

    // Collect arc and chord elements so they can be referenced via chords
    this.arcElements = [];
    this.arcs.each(function (d, i) { diagram.arcElements[i] = this; });
    this.chords.each(function (d) { d.element = this; });

    newArcs
      .on('mouseover', function (arc) { diagram.highlightChordsForArc(arc); })
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

    this.svg.classed('fade-arcs', true);
    this.svg.classed('fade-chords', true);
    d3.select(this.arcElements[arc.index]).classed('highlighted', true);

    this.chords // for each chord with source == arc
      .filter(function (chord) { return chord.source.index === arc.index; })
      .setColor(function (chord) { return diagram.colorScale(chord.target.index); })
      .classed('highlighted', true)
      .each(function (chord) { // highlight target arcs
        d3.select(diagram.arcElements[chord.target.index]).classed('highlighted', true);
      });

    this.chords // for each chord with target == arc
      .filter(function (chord) { return chord.target.index === arc.index; })
      .setColor(function (chord) { return diagram.colorScale(chord.source.index); })
      .classed('highlighted', true)
      .each(function (chord) { // highlight source arcs
        d3.select(diagram.arcElements[chord.source.index]).classed('highlighted', true);
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

  var currentChord = currentSource = currentTarget = null;
  Diagram.prototype.toggleChordHighlight = function (chord, toggle) {
    var source = this.arcElements[chord.source.index],
        target = this.arcElements[chord.target.index];

    // Only unhighlight (toggle == false) if currentChord hasn't changed
    if (toggle || chord === currentChord) {
      this.svg.classed('fade-arcs', toggle);
    }

    // For source/target
    // - only unhighlight if currentChord hasn't changed
    // - only highlght if source/target HAS changed

    if (toggle) {
      this.arcs.classed('highlighted', false);
    }

    d3.select(source).classed('highlighted', toggle);
    d3.select(target).classed('highlighted', toggle);

    console.log(chord.element);
    d3.select(chord.element).moveToFront();

    currentChord = chord;
    currentSource = source;
    currentTarget = target;
  };

  return Diagram;

})(d3, _);
