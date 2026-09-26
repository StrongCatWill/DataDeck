// data_deck_grants: consent grants for Data Deck.
// Paste into Solana Playground, build, deploy to devnet, download the IDL into src/idl/.
// Hard rule: no health terms in any account or instruction (NFR-1).
use anchor_lang::prelude::*;

declare_id!("rwoLAon5MSWyDo1wTistRj2McNJTUF1f1pwdnxzJxLP"); // Playground build 2026-09-26; not yet deployed to devnet

const STREAM_SECS: i64 = 30 * 10; // demo clock: 30 days x 10 s
const SNAPSHOT_SECS: i64 = 24 * 3600;
const QUERY_SECS: i64 = 24 * 3600;

#[program]
pub mod data_deck_grants {
    use super::*;

    pub fn set_rule_delegate(ctx: Context<SetRuleDelegate>, delegate: Pubkey, rule_hash: [u8; 32], expires_at: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(expires_at > now && expires_at <= now + 90 * 86_400, GrantError::RuleExpiryOutOfRange);
        let rd = &mut ctx.accounts.rule_delegate;
        rd.player = ctx.accounts.player.key();
        rd.delegate = delegate;
        rd.rule_hash = rule_hash;
        rd.expires_at = expires_at;
        rd.active = true;
        Ok(())
    }

    pub fn disable_delegate(ctx: Context<DisableDelegate>) -> Result<()> {
        ctx.accounts.rule_delegate.active = false;
        Ok(())
    }

    pub fn create_grant(
        ctx: Context<CreateGrant>,
        grant_id: [u8; 16],
        bounty_hash: [u8; 32],
        access_type: u8,
        price_per_day: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let signer = ctx.accounts.signer.key();
        let player = ctx.accounts.player.key();

        let (auto, rule_hash) = if signer == player {
            (false, [0u8; 32])
        } else {
            // Delegate path: must be active, unexpired, and capped at a 30-day stream.
            let rd = ctx.accounts.rule_delegate.as_ref().ok_or(GrantError::NotAuthorised)?;
            require!(rd.active && rd.delegate == signer && rd.expires_at > now, GrantError::NotAuthorised);
            (true, rd.rule_hash)
        };

        let ttl = match access_type {
            0 => SNAPSHOT_SECS,
            1 => STREAM_SECS,
            2 => QUERY_SECS,
            _ => return err!(GrantError::BadAccessType),
        };

        let g = &mut ctx.accounts.grant;
        g.player = player;
        g.researcher = ctx.accounts.researcher.key();
        g.grant_id = grant_id;
        g.bounty_hash = bounty_hash;
        g.access_type = access_type;
        g.created_at = now;
        g.expires_at = now + ttl;
        g.price_per_day = price_per_day;
        g.status = STATUS_ACTIVE;
        g.auto = auto;
        g.rule_hash = rule_hash;
        g.revoked_at = 0;
        Ok(())
    }

    pub fn revoke_grant(ctx: Context<RevokeGrant>) -> Result<()> {
        let g = &mut ctx.accounts.grant;
        require!(g.status == STATUS_ACTIVE, GrantError::NotActive);
        g.status = STATUS_REVOKED;
        g.revoked_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn consume_grant(ctx: Context<ConsumeGrant>) -> Result<()> {
        let g = &mut ctx.accounts.grant;
        require!(g.access_type == 2, GrantError::BadAccessType);
        require!(g.status == STATUS_ACTIVE, GrantError::NotActive);
        require!(Clock::get()?.unix_timestamp < g.expires_at, GrantError::Expired);
        g.status = STATUS_CONSUMED;
        Ok(())
    }
}

pub const STATUS_ACTIVE: u8 = 0;
pub const STATUS_REVOKED: u8 = 1;
pub const STATUS_CONSUMED: u8 = 2;

#[account]
#[derive(InitSpace)]
pub struct Grant {
    pub player: Pubkey,
    pub researcher: Pubkey,
    pub grant_id: [u8; 16],
    pub bounty_hash: [u8; 32],
    pub access_type: u8,
    pub created_at: i64,
    pub expires_at: i64,
    pub price_per_day: u64,
    pub status: u8,
    pub auto: bool,
    pub rule_hash: [u8; 32],
    pub revoked_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct RuleDelegate {
    pub player: Pubkey,
    pub delegate: Pubkey,
    pub rule_hash: [u8; 32],
    pub expires_at: i64,
    pub active: bool,
}

#[derive(Accounts)]
pub struct SetRuleDelegate<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(init_if_needed, payer = player, space = 8 + RuleDelegate::INIT_SPACE, seeds = [b"rules", player.key().as_ref()], bump)]
    pub rule_delegate: Account<'info, RuleDelegate>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisableDelegate<'info> {
    pub player: Signer<'info>,
    #[account(mut, seeds = [b"rules", player.key().as_ref()], bump, has_one = player)]
    pub rule_delegate: Account<'info, RuleDelegate>,
}

#[derive(Accounts)]
#[instruction(grant_id: [u8; 16])]
pub struct CreateGrant<'info> {
    /// Player or their rule delegate; pays rent.
    #[account(mut)]
    pub signer: Signer<'info>,
    /// CHECK: the player the grant belongs to; authority checked in the handler.
    pub player: UncheckedAccount<'info>,
    /// CHECK: per-study researcher key; only stored.
    pub researcher: UncheckedAccount<'info>,
    #[account(seeds = [b"rules", player.key().as_ref()], bump)]
    pub rule_delegate: Option<Account<'info, RuleDelegate>>,
    #[account(init, payer = signer, space = 8 + Grant::INIT_SPACE, seeds = [b"grant", player.key().as_ref(), grant_id.as_ref()], bump)]
    pub grant: Account<'info, Grant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeGrant<'info> {
    pub player: Signer<'info>,
    #[account(mut, has_one = player)]
    pub grant: Account<'info, Grant>,
}

#[derive(Accounts)]
pub struct ConsumeGrant<'info> {
    pub researcher: Signer<'info>,
    #[account(mut, has_one = researcher)]
    pub grant: Account<'info, Grant>,
}

#[error_code]
pub enum GrantError {
    #[msg("Signer is neither the player nor an active, unexpired rule delegate")]
    NotAuthorised,
    #[msg("Unknown access type")]
    BadAccessType,
    #[msg("Grant is not active")]
    NotActive,
    #[msg("Grant has expired")]
    Expired,
    #[msg("Rule delegate expiry must be in the future and at most 90 days out")]
    RuleExpiryOutOfRange,
}
