const {
    SlashCommandBuilder, EmbedBuilder,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder,
} = require('discord.js');
const axios = require('axios');

const CUSTOM_ID_PREFIX = 'price_select_';

const STEAM_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
};

const ITAD_API = 'https://api.isthereanydeal.com';

async function steamSearch(query) {
    const { data } = await axios.get('https://store.steampowered.com/api/storesearch/', {
        params: { term: query, l: 'english', cc: 'PH' },
        headers: STEAM_HEADERS,
        timeout: 10000,
    });
    return (data.items ?? []).filter(i => i.type === 'app');
}

async function steamDetails(appId) {
    const { data } = await axios.get('https://store.steampowered.com/api/appdetails/', {
        params: { appids: appId, cc: 'ph', l: 'en' },
        headers: STEAM_HEADERS,
        timeout: 10000,
    });
    return data[appId]?.success ? data[appId].data : null;
}

// Returns { amount, currency, timestamp } or null
async function itadHistory(appId) {
    try {
        const key = process.env.ITAD_API_KEY;

        const { data: lookup } = await axios.get(`${ITAD_API}/games/lookup/v1`, {
            params: { appid: appId, key },
            timeout: 8000,
        });
        if (!lookup.found) return null;

        const { data: lows } = await axios.post(
            `${ITAD_API}/games/historylow/v1`,
            [lookup.game.id],
            { params: { country: 'PH', key }, timeout: 8000 },
        );
        const low = lows?.[0]?.low;
        if (!low) return null;

        return { amount: low.price.amount, currency: low.price.currency, timestamp: low.timestamp, shop: low.shop.name };
    } catch {
        return null;
    }
}

function formatUnixDate(unix) {
    return new Date(unix * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
}

function formatCents(cents) {
    return `₱${(cents / 100).toFixed(2)}`;
}

// Label shown in the select menu option description
function searchPriceLabel(item) {
    const p = item.price;
    if (!p) return 'N/A';
    const price = formatCents(p.final);
    if (p.initial > p.final) {
        const pct = Math.round((1 - p.final / p.initial) * 100);
        return `${price}  (-${pct}% off)`;
    }
    return price;
}

function buildPriceEmbed(appId, gameName, details, cheap) {
    const storeUrl   = `https://store.steampowered.com/app/${appId}/`;
    const steamdbUrl = `https://steamdb.info/app/${appId}/`;
    const title      = details?.name ?? gameName;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setURL(storeUrl)
        .setImage(`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`)
        .setColor(0x1b2838);

    if (details?.is_free) {
        embed.addFields({ name: 'Price', value: 'Free to Play', inline: true });
    } else {
        const p = details?.price_overview;
        if (p) {
            if (p.discount_percent > 0) {
                embed.addFields(
                    { name: 'Original Price', value: p.initial_formatted || formatCents(p.initial), inline: true },
                    { name: `On Sale (-${p.discount_percent}%)`, value: p.final_formatted || formatCents(p.final), inline: true },
                );
                embed.setColor(0x4c6b22);
            } else {
                embed.addFields({
                    name: 'Price',
                    value: p.final_formatted || formatCents(p.final),
                    inline: true,
                });
            }
        } else {
            embed.addFields({ name: 'Price', value: 'N/A (region-locked or delisted)', inline: true });
        }
    }

    if (cheap?.amount) {
        const symbol = cheap.currency === 'PHP' ? '₱' : cheap.currency + ' ';
        embed.addFields(
            { name: 'Historical Low', value: `${symbol}${cheap.amount.toFixed(2)} via ${cheap.shop}`, inline: true },
            { name: 'Last Sale Date', value: formatUnixDate(new Date(cheap.timestamp).getTime() / 1000), inline: true },
        );
    }

    embed.addFields({
        name: '​',
        value: `[View full price history on SteamDB ↗](${steamdbUrl})`,
    });

    return embed;
}

async function fetchAndShowPrice(interaction, appId, gameName) {
    const [details, cheap] = await Promise.all([
        steamDetails(appId).catch(() => null),
        itadHistory(appId).catch(() => null),
    ]);
    const embed = buildPriceEmbed(appId, gameName, details, cheap);
    await interaction.editReply({ content: '', components: [], embeds: [embed] });
}

module.exports = {
    CUSTOM_ID_PREFIX,

    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription("Check a Steam game's price and sale history")
        .addStringOption(opt =>
            opt.setName('game').setDescription('Game name to search for').setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const query = interaction.options.getString('game');

        let games;
        try {
            games = await steamSearch(query);
        } catch {
            return interaction.editReply('Could not reach Steam. Please try again later.');
        }

        if (games.length === 0) {
            return interaction.editReply(`No Steam game found for **${query}**.`);
        }

        // Single result — go straight to price
        if (games.length === 1) {
            return fetchAndShowPrice(interaction, games[0].id, games[0].name);
        }

        // Multiple results — show a select menu (Discord allows up to 25 options)
        const options = games.slice(0, 25).map(g =>
            new StringSelectMenuOptionBuilder()
                .setLabel(g.name.slice(0, 100))
                .setValue(`${g.id}|${g.name.slice(0, 89)}`)
                .setDescription(searchPriceLabel(g).slice(0, 100))
        );

        const select = new StringSelectMenuBuilder()
            .setCustomId(`${CUSTOM_ID_PREFIX}${interaction.user.id}`)
            .setPlaceholder('Select a game…')
            .addOptions(options);

        await interaction.editReply({
            content: `Found **${games.length}** results for **${query}** — pick one:`,
            components: [new ActionRowBuilder().addComponents(select)],
        });
    },

    async handleSelect(interaction) {
        await interaction.deferUpdate();
        const value    = interaction.values[0];
        const pipe     = value.indexOf('|');
        const appId    = parseInt(value.slice(0, pipe), 10);
        const gameName = value.slice(pipe + 1);
        await fetchAndShowPrice(interaction, appId, gameName);
    },
};
