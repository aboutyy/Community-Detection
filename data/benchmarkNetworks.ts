import { BenchmarkNetwork } from '../types';

export const BENCHMARK_NETWORKS: BenchmarkNetwork[] = [
    {
        id: 'karate',
        name: "Zachary's Karate Club",
        edgeList: `1 2
1 3
1 4
1 5
1 6
1 7
1 8
1 9
1 11
1 12
1 13
1 14
1 18
1 20
1 22
1 32
2 3
2 4
2 8
2 14
2 18
2 20
2 22
3 4
3 8
3 9
3 10
3 14
3 28
3 29
3 30
3 31
3 33
3 34
4 8
4 13
4 14
5 7
5 11
6 7
6 11
6 17
7 17
9 31
9 33
9 34
10 34
14 34
15 33
15 34
16 33
16 34
19 33
19 34
20 34
21 33
21 34
23 33
23 34
24 26
24 28
24 30
24 33
24 34
25 26
25 28
25 32
26 32
27 30
27 34
28 34
29 32
29 34
30 32
30 33
30 34
31 33
31 34
32 33
32 34
33 34`,
        groundTruth: [
            { node: '1', community: 0 }, { node: '2', community: 0 }, { node: '3', community: 0 }, { node: '4', community: 0 },
            { node: '5', community: 0 }, { node: '6', community: 0 }, { node: '7', community: 0 }, { node: '8', community: 0 },
            { node: '10', community: 0 }, { node: '11', community: 0 }, { node: '12', community: 0 }, { node: '13', community: 0 },
            { node: '14', community: 0 }, { node: '17', community: 0 }, { node: '18', community: 0 }, { node: '20', community: 0 },
            { node: '22', community: 0 }, { node: '9', community: 1 }, { node: '15', community: 1 }, { node: '16', community: 1 },
            { node: '19', community: 1 }, { node: '21', community: 1 }, { node: '23', community: 1 }, { node: '24', community: 1 },
            { node: '25', community: 1 }, { node: '26', community: 1 }, { node: '27', community: 1 }, { node: '28', community: 1 },
            { node: '29', community: 1 }, { node: '30', community: 1 }, { node: '31', community: 1 }, { node: '32', community: 1 },
            { node: '33', community: 1 }, { node: '34', community: 1 }
        ],
        nodeDetails: {
            '1': { description: 'Mr. Hi (Instructor)' },
            '34': { description: 'John A. (Officer)' }
        }
    },
    {
        id: 'lesmis',
        name: "Les Misérables Characters",
        edgeList: `Napoleon Valjean
Myriel Napoleon
Mlle.Baptistine Valjean
Mme.Magloire Valjean
Mme.Magloire Mlle.Baptistine
CountessdeLo Valjean
Geborand Valjean
Champtercier Valjean
Cravatte Valjean
Count Valjean
OldMan Valjean
Labarre Valjean
Valjean Marguerite
Mme.deR Valjean
Isabeau Valjean
Gervais Valjean
Valjean Tholomyes
Tholomyes Fantine
Fantine Valjean
Mme.Thenardier Fantine
Mme.Thenardier Valjean
Thenardier Mme.Thenardier
Thenardier Valjean
Cosette Mme.Thenardier
Cosette Valjean
Javert Fantine
Javert Valjean
Fauchelevent Valjean
Bamatabois Fantine
Bamatabois Javert
Bamatabois Valjean
Perpetue Fantine
Simplice Fantine
Scaufflaire Valjean
Woman1 Valjean
Judge Valjean
Champmathieu Valjean
Brevet Valjean
Chenildieu Valjean
Cochepaille Valjean
Pontmercy Thenardier
Boulatruelle Thenardier
Eponine Mme.Thenardier
Anzelma Thenardier
Woman2 Valjean
MotherInnocent Valjean
Gribier Fauchelevent
Mlle.Gillenormand Valjean
Mme.Pontmercy Mlle.Gillenormand
Mlle.Vaubois Mlle.Gillenormand
Lt.Gillenormand Mlle.Gillenormand
Marius Mlle.Gillenormand
Marius Pontmercy
BaronessT Marius
Mabeuf Marius
Enjolras Marius
Combeferre Enjolras
Prouvaire Enjolras
Feuilly Enjolras
Courfeyrac Enjolras
Bahorel Enjolras
Bossuet Enjolras
Joly Enjolras
Grantaire Bossuet
Grantaire Enjolras
MotherPlutarch Mabeuf
Gueulemer Thenardier
Babet Thenardier
Claquesous Thenardier
Montparnasse Thenardier
Montparnasse Valjean
Gavroche Thenardier
Gavroche Marius
Gavroche Valjean
Magnon Mme.Pontmercy
Mlle.Gillenormand Marius
Valjean Cosette
Javert Marius`,
        groundTruth: [], // No ground truth for this exploratory network
        nodeDetails: {
            'Valjean': {
                description: '（2012年电影版由休·杰克曼饰演）冉阿让，本书主角。因偷窃面包被判刑，多次越狱失败后最终假释。他被米里哀主教感化，化名马德兰，成为成功的商人和市长，一生都在躲避警官沙威的追捕，同时践行着主教教诲的善良与正直。',
            },
            'Javert': {
                description: '（2012年电影版由罗素·克劳饰演）沙威，一名固执、冷酷的警官。他坚信法律至高无上，对冉阿让紧追不舍。他代表着僵化的秩序和无情的正义，最终在法律与道德的冲突中信仰崩溃，选择了自尽。',
            },
            'Fantine': {
                description: '（2012年电影版由安妮·海瑟薇饰演）芳汀，一位美丽的巴黎女工。她被情人抛弃后，为抚养女儿珂赛特而被迫出卖一切，最终在贫病交加中悲惨死去。她是社会不公的受害者，也是母爱伟大的象征。',
            },
            'Cosette': {
                description: '（2012年电影版由阿曼达·塞弗里德饰演）珂赛特，芳汀的女儿。童年被德纳第夫妇虐待，后被冉阿让收养，过上了幸福的生活。她与马吕斯相爱，是书中纯洁与希望的象征。',
            },
            'Marius': {
                description: '（2012年电影版由埃迪·雷德梅恩饰演）马吕斯，一位富有理想的青年贵族。他因政治观念与外祖父决裂，后加入了ABC之友社，参与了1832年巴黎共和党人起义。他在起义中幸存，最终与珂赛特结婚。',
            },
            'Eponine': {
                description: '（2012年电影版由萨曼莎·巴克斯饰演）艾潘妮，德纳第夫妇的长女。她深爱着马吕斯，但这份爱从未得到回应。为了保护马吕斯，她在街垒战中为他挡下子弹而死，是一个悲剧性的角色。',
            },
            'Thenardier': {
                description: '（2012年电影版由萨莎·拜伦·科恩饰演）德纳第，一个贪婪、自私、毫无道德底线的旅店老板。他虐待童年珂赛特，敲诈勒索冉阿让和芳汀，是社会底层丑恶与邪恶的集中体现。',
            },
            'Mme.Thenardier': {
                description: '（2012年电影版由海伦娜·伯翰·卡特饰演）德纳第夫人，德纳第的妻子。她同样贪婪、刻薄，与丈夫一同虐待珂赛特，是其邪恶的帮凶。',
            },
            'Enjolras': {
                description: '（2012年电影版由亚伦·特维特饰演）安灼拉，ABC之友社的领袖，一位充满激情和魅力的革命者。他为了共和理想而战，在街垒战中英勇牺牲。',
            },
            'Gavroche': {
                description: '（2012年电影版由丹尼尔·赫特尔斯通饰演）伽弗洛什，德纳第夫妇被遗弃的儿子，一个机智、勇敢、善良的巴黎流浪儿。他在街垒战中为革命者收集弹药时，高唱着歌谣被射杀。',
            },
            'Myriel': {
                description: '（2012年电影版由科尔姆·威尔金森饰演）米里哀主教，一位仁慈、善良、充满智慧的主教。他用宽恕和赠予感化了走投无路的冉阿让，彻底改变了他的人生轨迹，是书中神圣与救赎的化身。',
            },
            'Mlle.Gillenormand': {
                description: '（2012年电影版中该角色戏份较少）吉诺曼小姐，马吕斯的外祖父，一位思想陈旧但内心疼爱外孙的保皇党人。他与马吕斯的冲突代表了旧时代与新思想的碰撞。',
            }
        }
    },
    {
        id: 'santafe',
        name: "SFI Collaboration Network",
        edgeList: `1 2
1 3
1 4
1 5
1 6
1 7
2 8
2 9
3 10
3 11
4 12
4 13
5 14
6 15
7 16
8 11
8 17
8 18
9 19
9 20
10 21
10 22
10 23
11 1
11 24
12 25
13 26
14 27
14 28
14 29
15 30
16 31
17 19
17 32
18 33
18 34
19 2
19 35
20 36
21 37
22 38
23 39
24 40
24 41
25 42
26 43
27 44
28 45
29 46
30 47
31 48
32 49
32 50
33 51
34 52
35 53
36 54
37 55
38 56
39 57
40 58
41 59
42 60
43 61
44 62
45 63
46 64
47 65
48 66
49 67
50 68
51 69
52 70
53 71
54 72
55 73
56 74
57 75
58 76
59 77
60 78
61 79
62 80
63 81
64 82
65 83
66 84
67 85
68 86
87 105
88 106
89 107
90 108
91 109
92 110
93 111
94 112
95 113
96 114
97 115
98 116
99 117
100 118`,
        groundTruth: [] // Also an exploratory network
    }
];