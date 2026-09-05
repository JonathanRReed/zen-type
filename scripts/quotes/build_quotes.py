#!/usr/bin/env python3
"""Build public/quotes.json.

Every quote is either (a) a sentence lifted verbatim from a public-domain
edition on Project Gutenberg (the extractor in extract.py pulled the
candidates; the ones below were picked by hand), (b) a public-domain line
whose source is named, or (c) a traditional proverb. Nothing here is a modern
translation, a living author, or an "attributed" internet quote.
"""
import json, os, re, unicodedata

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'quotes.json')

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def clean(t):
    t = t.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    t = t.replace('—', ', ').replace('–', '-').replace('--', ', ')
    t = re.sub(r'\s+,', ',', t)
    t = re.sub(r'\s{2,}', ' ', t).strip()
    return t

GROUPS = []

def group(author, source, tags, lines):
    GROUPS.append((author, source, tags, [clean(l) for l in lines]))

group('Marcus Aurelius', 'Meditations, trans. Meric Casaubon (1634)', ['stoic', 'mind'], [
    "Remember that all is but opinion, and all opinion depends of the mind.",
    "Let opinion be taken away, and no man will think himself wronged.",
    "The effect of true philosophy is unaffected simplicity and modesty.",
    "Fame after life is no better than oblivion.",
    "All things that are, are both usual and of little continuance.",
    "Desire not then that which is impossible.",
    "Whatsoever is besides either is already past, or uncertain.",
    "A happy lot and portion is good inclinations of the soul, good desires, good actions.",
    "Virtue alone is happiness, and vice is unhappiness.",
    "All things that are in the world are always in the estate of alteration.",
    "The motion of the mind is not as the motion of a dart.",
    "There is but one light of the sun, though it be intercepted by walls and mountains, and other thousand objects.",
    "Give thyself leisure to learn some good thing, and cease roving and wandering to and fro.",
    "Afford then thyself this retiring continually, and thereby refresh and renew thyself.",
    "Whatsoever is earthly presseth downwards to the common earth.",
    "The cause of the universe is as it were a strong torrent, it carrieth all away.",
])

group('Marcus Aurelius', 'Meditations, trans. George Long (1862)', ['stoic', 'mind'], [
    "Confine thyself to the present.",
    "If it is not right, do not do it: if it is not true, do not say it.",
    "Such as are thy habitual thoughts, such also will be the character of thy mind; for the soul is dyed by the thoughts.",
])

group('Lao Tzu', 'Tao Te Ching, trans. James Legge (1891)', ['tao', 'stillness'], [
    "The Tao that can be trodden is not the enduring and unchanging Tao.",
    "Gentleness is sure to be victorious even in battle, and firmly to maintain its ground.",
    "Words that are strictly true seem to be paradoxical.",
    "A violent wind does not last for a whole morning; a sudden rain does not last for the whole day.",
    "Governing a great state is like cooking small fish.",
    "Purity and stillness give the correct law to all under heaven.",
    "The meshes of the net of Heaven are large; far apart, but letting nothing escape.",
    "Let it be still, and it will gradually become clear.",
    "Let movement go on, and the condition of rest will gradually arise.",
    "Sincere words are not fine; fine words are not sincere.",
    "Gravity is the root of lightness; stillness, the ruler of movement.",
    "Constant action overcomes cold; being still overcomes heat.",
    "The soft overcomes the hard; and the weak the strong.",
    "Whatever is contrary to the Tao soon ends.",
    "Action should be taken before a thing has made its appearance; order should be secured before disorder has begun.",
    "There is no calamity greater than lightly engaging in war.",
    "The journey of a thousand li commenced with a single step.",
    "He who knows other men is discerning; he who knows himself is intelligent.",
    "The softest thing in the world dashes against and overcomes the hardest.",
    "Heaven is long-enduring and earth continues long.",
])

group('Zhuangzi', 'The Writings of Chuang Tzu, trans. James Legge (1891)', ['tao', 'stillness'], [
    "The perfect man employs his mind as a mirror.",
])

group('Henry David Thoreau', 'Walden (1854)', ['nature', 'simplicity'], [
    "I went to the woods because I wished to live deliberately, to front only the essential facts of life.",
    "If one advances confidently in the direction of his dreams, and endeavors to live the life which he has imagined, he will meet with a success unexpected in common hours.",
    "Books are the treasured wealth of the world and the fit inheritance of generations and nations.",
    "The incessant anxiety and strain of some is a well nigh incurable form of disease.",
    "The purity men love is like the mists which envelop the earth, and not like the azure ether beyond.",
    "There is an incessant influx of novelty into the world, and yet we tolerate incredible dulness.",
    "God himself culminates in the present moment, and will never be more divine in the lapse of all the ages.",
    "Shall we always study to obtain more of these things, and not sometimes to be content with less?",
    "The best books are not read even by those who are called good readers.",
    "Every nail driven should be as another rivet in the machine of the universe, you carrying on the work.",
    "Public opinion is a weak tyrant compared with our own private opinion.",
    "All nature is your congratulation, and you have cause momentarily to bless yourself.",
    "The life which men praise and regard as successful is but one kind.",
    "Nature and human life are as various as our several constitutions.",
    "The greatest gains and values are farthest from being appreciated.",
    "Shams and delusions are esteemed for soundest truths, while reality is fabulous.",
    "Could a greater miracle take place than for us to look through each other's eyes for an instant?",
    "Follow your genius closely enough, and it will not fail to show you a fresh prospect every hour.",
    "All change is a miracle to contemplate; but it is a miracle which is taking place every instant.",
    "Walden is blue at one time and green at another, even from the same point of view.",
    "The lawyer's truth is not Truth, but consistency or a consistent expediency.",
])

group('Henry David Thoreau', 'Walking (1862)', ['nature', 'simplicity'], [
    "A town is saved, not more by the righteous men in it than by the woods and swamps that surround it.",
    "Unless our philosophy hears the cock crow in every barn-yard within our horizon, it is belated.",
    "There is plenty of genial love of Nature, but not so much of Nature herself.",
    "There is a keen enjoyment in a mere animal existence.",
    "An absolutely new prospect is a great happiness, and I can still get this any afternoon.",
    "Nature has a place for the wild clematis as well as for the cabbage.",
    "Dullness is but another name for tameness.",
    "Half the walk is but retracing our steps.",
    "Above all, we cannot afford not to live in the present.",
    "Eastward I go only by force; but westward I go free.",
    "Roads are made for horses and men of business.",
    "Not even does the moon shine every night, but gives place to darkness.",
    "The spring has come with its green crop.",
    "Give me the ocean, the desert, or the wilderness!",
])

group('The Buddha', 'Dhammapada, trans. F. Max Muller (1881)', ['buddhist', 'mind'], [
    "All that we are is the result of what we have thought: it is founded on our thoughts, it is made up of our thoughts.",
    "Victory breeds hatred, for the conquered is unhappy.",
    "Purity and impurity belong to oneself, no one can purify another.",
    "Good people shine from afar, like the snowy mountains; bad people are not seen, like arrows shot by night.",
    "Self is the lord of self, who else could be the lord?",
    "There is no fire like passion, there is no shark like hatred, there is no snare like folly, there is no torrent like greed.",
    "Let us live happily then, though we call nothing our own!",
    "There never was, there never will be, nor is there now, a man who is always blamed, or a man who is always praised.",
    "Be not thoughtless, watch your thoughts!",
    "Earnest among the thoughtless, awake among the sleepers, the wise man advances like a racer, leaving behind the hack.",
    "Not a mother, not a father will do so much, nor any other relative; a well-directed mind will do us greater service.",
    "Bad deeds, and deeds hurtful to ourselves, are easy to do; what is beneficial and good, that is very difficult to do.",
    "An evil deed is better left undone, for a man repents of it afterwards; a good deed is better done, for having done it, one does not repent.",
    "Like a well-guarded frontier fort, with defences within and without, so let a man guard himself.",
    "Death carries off a man who is gathering flowers and whose mind is distracted, as a flood carries off a sleeping village.",
    "Draw yourself out of the evil way, like an elephant sunk in mud.",
    "Whatever a hater may do to a hater, or an enemy to an enemy, a wrongly-directed mind will do us greater mischief.",
    "Let us live happily then, not hating those who hate us! among men who hate us let us dwell free from hatred!",
    "People praise earnestness; thoughtlessness is always blamed.",
    "Make thyself an island, work hard, be wise!",
])

group('Epictetus', 'The Golden Sayings, trans. Hastings Crossley (1903)', ['stoic', 'mind'], [
    "A live coal placed next a dead one will either kindle that or be quenched by it.",
    "True instruction is this: to learn to wish that each thing should come to pass as it does.",
    "The beginning of philosophy is to know the condition of one's own mind.",
    "The soul that companies with Virtue is like an ever-flowing source.",
    "Friend, bethink you first what it is you would do, and then what your own nature is able to bear.",
    "Let silence be your general rule; or say only what is necessary and in few words.",
    "Not death or pain is to be feared, but the fear of death or pain.",
    "Fortify thyself with contentment: that is an impregnable stronghold.",
    "A life entangled with Fortune is like a torrent.",
    "Exceed due measure, and the most delightful things become the least delightful.",
    "Care not to be thought to know anything.",
    "A ship should not ride on a single anchor, nor life on a single hope.",
    "Above all avoid speaking of persons, either in way of praise or blame, or comparison.",
    "Every life is a warfare, and that long and various.",
    "Try to enjoy the great festival of life with other men.",
    "Reflect that the chief source of all evils to Man, and of baseness and cowardice, is not death, but the fear of death.",
    "Count the cost, and then, if your desire still holds, try the wrestler's life.",
    "Habits and faculties are necessarily affected by the corresponding acts.",
    "Laughter should not be much, nor frequent, nor unrestrained.",
])

group('Epictetus', 'The Enchiridion', ['stoic', 'mind'], [
    "There are things which are within our power, and there are things which are beyond our power.",
    "The body is to everyone the proper measure of its possessions, as the foot is of the shoe.",
    "Sickness is an impediment to the body, but not to the will unless itself pleases.",
    "Let whatever appears to be the best be to you an inviolable law.",
    "Duties are universally measured by relations.",
    "Begin by prescribing to yourself some character and demeanor, such as you may preserve both alone and in company.",
    "Be mostly silent, or speak merely what is needful, and in few words.",
    "Do not yearn in desire toward it, but wait till it reaches you.",
    "Try, therefore, in the first place, not to be bewildered by appearances.",
    "Be not elated at any excellence not your own.",
    "Lameness is an impediment to the leg, but not to the will; and say this to yourself with regard to everything that happens.",
    "Remember that you must behave as at a banquet.",
    "Exercise, therefore, what is in your power.",
    "Everything has two handles: one by which it may be borne, another by which it cannot.",
])

group('Epictetus', 'The Discourses, trans. George Long (1877)', ['stoic', 'mind'], [
    "First say to yourself what you would be; and then do what you have to do.",
    "Neither to be disappointed in that which you desire, nor to fall into anything which you would avoid.",
    "Do you seek a reward for a good man greater than doing what is good and just?",
    "Disease is an impediment to the body, but not to the will, unless the will itself chooses.",
    "A tyrant never killed a man in six months: but a fever is often a year about it.",
    "Do not send your desire forward to it, but wait till it is opposite to you.",
    "The first then and highest purity is that which is in the soul; and we say the same of impurity.",
    "Do not admire your clothes, and then you will not be angry with the thief.",
    "See how tragedy is made when common things happen to silly men.",
    "Practise sometimes a way of living like a person out of health that you may at some time live like a man in health.",
    "Always remember what is your own, and what belongs to another; and you will not be disturbed.",
    "Keep by every means what is your own; do not desire what belongs to others.",
    "Remembering these rules, rejoice in that which is present, and be content with the things which come in season.",
    "Make no tragedy show of the thing, but speak of it as it is.",
    "Does the captain of a ship manage it better by not attending? and are any of the smaller acts done better by inattention?",
    "Do you not know that opinion conquers itself, and is not conquered by another?",
    "Make the best use of what is in our power, and take the rest as it happens.",
])

group('Michel de Montaigne', 'Essays, trans. Charles Cotton', ['craft', 'life'], [
    "There is no quality so universal in this image of things as diversity and variety.",
    "There is more understanding required in the teaching of others than in being taught.",
    "The application of ourselves to light and trivial things diverts us from those that are necessary and just.",
    "Even constancy itself is no other but a slower and more languishing motion.",
    "Order a purge for your brain, it will there be much better employed than upon your stomach.",
    "Have you known how to meditate and manage your life? You have performed the greatest work of all.",
    "The conscience of having well spent the other hours is the just and savoury sauce of the dinner-table.",
    "There is no reason that has not its contrary, say the wisest of the philosophers.",
    "The most simply to commit one's self to nature is to do it most wisely.",
    "The perpetual work of your life is but to lay the foundation of death.",
    "Nature is a gentle guide, but not more sweet and gentle than prudent and just.",
    "A quarter of an ounce of patience will provide sufficiently against such inconveniences.",
    "A soul clear from prejudice has a marvellous advance towards tranquillity and repose.",
    "A man cannot reasonably complain of diseases that fairly divide the time with health.",
    "An infinite number of brave actions must be performed without witness and lost, before one turns to account.",
    "Resemblance does not so much make one as difference makes another.",
    "There is no man so great a coward, that had not rather once fall than to be always falling.",
    "There is no subject so frivolous that does not merit a place in this rhapsody.",
])

group('Ralph Waldo Emerson', 'Essays: First Series (1841)', ['craft', 'life'], [
    "The way to speak and write what shall not go out of fashion is to speak and write sincerely.",
    "The objection to conforming to usages that have become dead to you is that it scatters your force.",
    "Society everywhere is in conspiracy against the manhood of every one of its members.",
    "The simplicity of the universe is very different from the simplicity of a machine.",
    "Prayer is the contemplation of the facts of life from the highest point of view.",
    "Silence is a solvent that destroys personality, and gives us leave to be great and universal.",
    "There is more difference in the quality of our pleasures than in the amount.",
    "The simplicity of nature is not that which may easily be read, but is inexhaustible.",
    "The length of the discourse indicates the distance of thought betwixt the speaker and the hearer.",
    "Fear is an instructor of great sagacity and the herald of all revolutions.",
    "The terrors of the storm are chiefly confined to the parlor and the cabin.",
    "Heroism is an obedience to a secret impulse of an individual's character.",
    "The infallible index of true progress is found in the tone the man takes.",
    "Virtue is the adherence in action to the nature of things, and the nature of things makes it prevalent.",
    "The laws of friendship are austere and eternal, of one web with the laws of nature and of morals.",
    "Persons and events may stand for a time between you and justice, but it is only a postponement.",
    "Never a magnanimity fell to the ground, but there is some heart to greet and accept it unexpectedly.",
    "The least activity of the intellectual powers redeems us in a degree from the conditions of time.",
    "Every faculty which is a receiver of pleasure has an equal penalty put on its abuse.",
])

group('Ralph Waldo Emerson', 'Essays: Second Series (1844)', ['craft', 'life'], [
    "Life is a series of surprises, and would not be worth taking or keeping if it were not.",
    "The tempered light of the woods is like a perpetual morning, and is stimulating and heroic.",
    "Into every intelligence there is a door which is never closed, through which the creator passes.",
    "A beauty not explicable is dearer than a beauty which we can see to the end of.",
    "The poorest experience is rich enough for all the purposes of expressing thought.",
    "Life itself is a mixture of power and form, and will not bear the least excess of either.",
    "Character is this moral order seen through the medium of an individual nature.",
    "The whirling bubble on the surface of a brook admits us to the secret of the mechanics of the sky.",
    "The difference between landscape and landscape is small, but there is great difference in the beholders.",
    "The secret of success in society is a certain heartiness and sympathy.",
    "All things show us that on every side we are very near to the best.",
    "Every natural function can be dignified by deliberation and privacy.",
    "Surely nobody would be a charlatan who could afford to be sincere.",
    "The reason of idleness and of crime is the deferring of our hopes.",
    "New actions are the only apologies and explanations of old ones which the noble can bear to offer or to receive.",
    "There is nothing so wonderful in any particular landscape as the necessity of being beautiful under which every landscape lies.",
    "The uprolled clouds and the colors of morning and evening will transfigure maples and alders.",
])

group('Kabir', 'Songs of Kabir, trans. Rabindranath Tagore (1915)', ['stillness', 'life'], [
    "The river and its waves are one surf: where is the difference between the river and its waves?",
    "The water-filled pitcher is placed upon water, it has water within and without.",
    "The musk is in the deer, but it seeks it not within itself: it wanders in quest of grass.",
    "Look, and see where the root is: happiness shall be yours when you come to the root.",
    "The flower blooms for the fruit: when the fruit comes, the flower withers.",
    "Be strong, and enter into your own body: for there your foothold is firm.",
    "The night is over and gone, would you lose your day also?",
    "Sing with gladness, and keep your seat unmoved within your heart.",
    "The world of man dances in laughter and tears.",
    "The rising and the setting are one to me; all contradictions are solved.",
    "The fire is in the wood; but who awakens it suddenly?",
    "The swan has taken its flight to the lake beyond the mountains; why should it search for the pools and ditches any more?",
    "The hills and the sea and the earth dance.",
    "Rains pour down without water, and the rivers are streams of light.",
    "There the light of the sun and the moon is shining: still your mind to silence before that splendour.",
    "Do not act the part of a madman, for the night is thickening fast.",
])

group('Blaise Pascal', 'Pensees, trans. W. F. Trotter (1904)', ['mind', 'life'], [
    "All the unhappiness of men arises from one single fact, that they cannot stay quietly in their own chamber.",
    "The heart has its reasons, which reason does not know.",
    "The last proceeding of reason is to recognise that there is an infinity of things which are beyond it.",
    "Custom should be followed only because it is custom, and not because it is reasonable or just.",
    "The whole visible world is only an imperceptible atom in the ample bosom of nature.",
    "Men are so necessarily mad, that not to be mad would amount to another form of madness.",
    "The last thing one settles in writing a book is what one should put in first.",
    "Contradiction is not a sign of falsity, nor the want of contradiction a sign of truth.",
    "There is nothing so conformable to reason as this disavowal of reason.",
    "There is a pleasure in being in a ship beaten about by a storm, when we are sure that it will not founder.",
    "Discourses on humility are a source of pride in the vain, and of humility in the humble.",
    "Time heals griefs and quarrels, for we change and are no longer the same persons.",
    "Tyranny is the wish to have in one way what can only be had in another.",
    "Thought is therefore by its nature a wonderful and incomparable thing.",
    "Not only are old impressions capable of misleading us; the charms of novelty have the same power.",
    "The kindness and the malice of the world in general are the same.",
])

group('Kakuzo Okakura', 'The Book of Tea (1906)', ['zen', 'craft'], [
    "Teaism is a cult founded on the adoration of the beautiful among the sordid facts of everyday existence.",
    "The whole ideal of Teaism is a result of this Zen conception of greatness in the smallest incidents of life.",
    "True beauty could be discovered only by one who mentally completed the incomplete.",
    "Dripping water from a flower vase need not be wiped away, for it may be suggestive of dew and coolness.",
    "Nothing is real except that which concerns the working of our own minds.",
    "Perhaps we reveal ourselves too much in small things because we have so little of the great to conceal.",
    "The tea-room is made for the tea master, not the tea-master for the tea-room.",
    "Truth can be reached only through the comprehension of opposites.",
    "The masterpiece is a symphony played upon our finest feelings.",
    "The world is groping in the shadow of egotism and vulgarity.",
    "Perfection is everywhere if we only choose to recognise it.",
    "People are not taught to be really virtuous, but to behave properly.",
    "Uniformity of design was considered fatal to the freshness of imagination.",
    "Through the disintegration of the old, re-creation becomes possible.",
    "A master has always something to offer, while we go hungry solely because of our own lack of appreciation.",
    "Memories long forgotten all come back to us with a new significance.",
    "The masterpiece is of ourselves, as we are of the masterpiece.",
    "Let us be less luxurious but more magnificent.",
    "The old masters are rightly to be honoured for opening the path to future enlightenment.",
    "Not a particle of dust will be found in the darkest corner, for if any exists the host is not a tea-master.",
    "There is a subtle charm in the taste of tea which makes it irresistible and capable of idealisation.",
])

group('Inazo Nitobe', 'Bushido: The Soul of Japan (1900)', ['craft', 'zen'], [
    "The spiritual aspect of valor is evidenced by composure, calm presence of mind.",
    "The cultivation of tender feelings breeds considerate regard for the sufferings of others.",
    "Calmness of behavior, composure of mind, should not be disturbed by passion of any kind.",
    "Things which are serious to ordinary people may be but play to the valiant.",
    "There is even a sportive element in a courageous nature.",
    "A self-possessed man knows the right time to use it, and such times come but rarely.",
    "Beneath the instinct to fight there lurks a diviner instinct to love.",
    "Virtues are no less contagious than vices.",
    "Be a virtue never so noble, it has its counterpart and counterfeit.",
])

group('Boethius', 'The Consolation of Philosophy, trans. W. V. Cooper (1902)', ['stoic', 'life'], [
    "Nature is content with few things, and with a very little of these.",
    "Oh, stupidest of mortals, if it takes to standing still, it ceases to be the wheel of Fortune.",
    "Verily, every harsh-seeming fortune, unless it either disciplines or amends, is punishment.",
    "Eternity is more than mere everlasting duration.",
    "High place without virtue is an evil, not a good.",
    "Happiness is the one end which all created beings seek.",
    "Titles command no reverence in distant and barbarous lands.",
    "Good, then, is the sum and source of all desirable things.",
    "Nature brooks not the union of contraries.",
    "The lust thereof is full of uneasiness; the sating, of repentance.",
    "Are friends any protection who have been attached by fortune, not by virtue?",
])

group('Socrates', 'Apology, trans. Benjamin Jowett (1871)', ['mind', 'life'], [
    "The unexamined life is not worth living.",
    "The hour of departure has arrived, and we go our ways, I to die, and you to live.",
    "The difficulty, my friends, is not to avoid death, but to avoid unrighteousness; for that runs faster than death.",
])

group('Plato', 'The Republic, trans. Benjamin Jowett (1871)', ['craft', 'mind'], [
    "The beginning is the most important part of any work.",
])

group('Walt Whitman', 'Leaves of Grass (1892)', ['nature', 'life'], [
    "Charity and personal force are the only investments worth anything.",
    "All comes by the body, only health puts you rapport with the universe.",
    "Ample are time and space, ample the fields of Nature.",
    "Clear and sweet is my soul, and clear and sweet is all that is not my soul.",
    "Whoever you are! claim your own at any hazard!",
    "Play the old role, the role that is great or small according as one makes it!",
])

group('Confucius', 'The Analects, trans. James Legge (1861)', ['craft', 'mind'], [
    "Men of principle are sure to be bold, but those who are bold may not always be men of principle.",
    "Let your evinced desires be for what is good, and the people will be good.",
    "Let relaxation and enjoyment be found in the polite arts.",
    "Looking at small advantages prevents great affairs from being accomplished.",
    "The ardent will advance and lay hold of truth; the cautiously-decided will keep themselves from what is wrong.",
    "The superior man does not, even for the space of a single meal, act contrary to virtue.",
    "The days and months are passing away; the years do not wait for us.",
    "Riches and honours acquired by unrighteousness are to me as a floating cloud.",
    "Want of forbearance in small matters confounds great plans.",
    "The superior man honours the talented and virtuous, and bears with all.",
    "Recompense injury with justice, and recompense kindness with kindness.",
    "Ornament is as substance; substance is as ornament.",
    "The wise are joyful; the virtuous are long-lived.",
    "The wise are active; the virtuous are tranquil.",
    "The grass must bend, when the wind blows across it.",
    "The virtuous rest in virtue; the wise desire virtue.",
    "Hearing much and selecting what is good and following it; seeing much and keeping it in memory: this is the second style of knowledge.",
    "The Master angled, but did not use a net.",
    "Are bells and drums all that is meant by music?",
    "The mean man is difficult to serve, and easy to please.",
])

group('Seneca', 'Letters to Lucilius, trans. Richard M. Gummere (1917)', ['stoic', 'life'], [
    "Begin at once to live, and count each separate day as a separate life.",
    "We are more often frightened than hurt; and we suffer more from imagination than from reality.",
    "While we are postponing, life speeds by.",
])

group('Heraclitus', 'Fragments, trans. John Burnet (1892)', ['mind', 'life'], [
    "You cannot step twice into the same rivers; for fresh waters are ever flowing in upon you.",
    "Man's character is his fate.",
    "The sun is new every day.",
])

group('Emily Dickinson', 'Poems (1890)', ['life', 'stillness'], [
    "Forever is composed of nows.",
])

group('Arthur Schopenhauer', 'Counsels and Maxims, trans. T. Bailey Saunders (1890)', ['life', 'mind'], [
    "Each day is a little life: every waking and rising a little birth, every fresh morning a little youth, every going to rest and sleep a little death.",
])

group('Proverb', 'Chinese proverb', ['simplicity', 'life'], [
    "The best time to plant a tree was twenty years ago. The second best time is now.",
    "A bird does not sing because it has an answer. It sings because it has a song.",
])

group('Proverb', 'Japanese proverb', ['simplicity', 'life'], [
    "Fall seven times and stand up eight.",
    "One kind word can warm three winter months.",
])

group('Proverb', 'Zen saying', ['zen', 'simplicity'], [
    "Before enlightenment, chop wood, carry water. After enlightenment, chop wood, carry water.",
    "When walking, walk. When eating, eat.",
    "All know the way, but few actually walk it.",
    "The obstacle is the path.",
    "Sitting quietly, doing nothing, spring comes, and the grass grows by itself.",
    "Let go or be dragged.",
])

group('Proverb', 'Tibetan proverb', ['simplicity', 'life'], [
    "Eat half, walk double, laugh triple, and love without measure.",
])

group('Proverb', 'Arabic proverb', ['life'], [
    "He who has health has hope, and he who has hope has everything.",
])

# Build
quotes = []
seen = set()
counts = {}
for author, source, tags, lines in GROUPS:
    base = slug(author if author != 'Proverb' else source.split()[0] + '-proverb')
    for line in lines:
        key = re.sub(r'[^a-z]', '', line.lower())
        if key in seen:
            print('DUP', line)
            continue
        seen.add(key)
        counts[base] = counts.get(base, 0) + 1
        quotes.append({
            'id': f'{base}-{counts[base]:02d}',
            'text': line,
            'author': author,
            'source': source,
            'tags': tags,
        })

# Sanity: typable characters only.
bad = [q for q in quotes if re.search(r"[^A-Za-z0-9 .,;:!?'\"()\-]", q['text'])]
for q in bad:
    print('NONASCII', q['id'], q['text'])

json.dump(quotes, open(OUT, 'w'), ensure_ascii=False, indent=2)
open(OUT, 'a').write('\n')

from collections import Counter
print('total', len(quotes))
print('authors', len(set(q['author'] for q in quotes)))
lengths = Counter('short' if len(q['text']) <= 80 else 'medium' if len(q['text']) <= 150 else 'long' for q in quotes)
print('lengths', dict(lengths))
tags = Counter(t for q in quotes for t in q['tags'])
print('tags', dict(tags))
