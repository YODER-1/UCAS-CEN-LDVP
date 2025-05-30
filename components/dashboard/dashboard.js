// 标准颜色方案：蓝橙红绿
const standardColors = {
    primary: ["#0288d1", "#ff9800", "#f44336", "#4caf50"],
    line: "#ff9800", // 趋势线、拟合线、平均线统一使用橙色
    background: "#e6e6e6"
};

// 创建tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// 加载数据并创建图表
d3.json("../../data/overall_participation.json").then(data => {
    // 更新KPI卡片
    document.getElementById("total-course").textContent = data.total_course.toLocaleString();
    document.getElementById("conversion-rate-value").textContent = (data.learning_conversion_rate * 100).toFixed(1) + "%";
    document.getElementById("total-courses").textContent = data.total_selected_courses_count.toLocaleString();
    document.getElementById("total-duration").textContent = Math.round(data.total_learning_duration_hours).toLocaleString();
    document.getElementById("avg-courses").textContent = data.avg_courses_per_total_learner.toFixed(1);
    document.getElementById("avg-duration").textContent = data.avg_learning_duration_per_actual_learner.toFixed(1);

    // 创建比较柱状图
    createBarChart(data);
});

// 创建环形进度条
function createProgressRing(rate) {
    const svg = d3.select("#conversion-rate");
    const width = 60;
    const height = 60;
    const radius = Math.min(width, height) / 2;
    const thickness = 8;

    svg.attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // 背景圆环
    g.append("path")
        .attr("d", d3.arc()
            .innerRadius(radius - thickness)
            .outerRadius(radius)
            .startAngle(0)
            .endAngle(2 * Math.PI))
        .attr("fill", "#e6e6e6");

    // 进度圆环
    g.append("path")
        .attr("d", d3.arc()
            .innerRadius(radius - thickness)
            .outerRadius(radius)
            .startAngle(0)
            .endAngle(2 * Math.PI * rate))
        .attr("fill", standardColors.primary[0]);
}

// 创建比较柱状图
function createBarChart(data) {
    const svg = d3.select("#bar-chart");
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = svg.node().getBoundingClientRect().width;
    const height = 400;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chartData = [
        { label: "总选课人数", value: data.total_selected_users },
        { label: "实际学习人数", value: data.actual_learning_users },
        { label: "选课未学习人数", value: data.selected_not_learned_users }
    ];

    const x = d3.scaleBand()
        .domain(chartData.map(d => d.label))
        .range([0, innerWidth])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.value)])
        .range([innerHeight, 0]);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 添加坐标轴
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("科研人员群体类别");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("科研人员数量");

    // 添加柱状图
    const bars = g.selectAll("rect")
        .data(chartData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.label))
        .attr("y", innerHeight)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("fill", (d, i) => standardColors.primary[i % standardColors.primary.length]);

    // 添加动画效果
    bars.transition()
        .duration(800)
        .delay((d, i) => i * 200) // 每个柱子延迟200ms
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr("y", d => y(d.value))
        .attr("height", d => innerHeight - y(d.value));

    // 添加交互效果
    bars.on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#026aa7");

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);

            tooltip.html(`${d.label}: ${d.value.toLocaleString()}`)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#0288d1");

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });
}